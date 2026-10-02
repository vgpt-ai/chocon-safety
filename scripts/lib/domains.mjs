// SPDX-License-Identifier: GPL-3.0-only
import { domainToASCII } from 'node:url';

const LABEL = /^[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$/;

/**
 * Chuẩn hóa hostname về dạng ASCII chữ thường, không có dấu chấm cuối.
 * Trả về null nếu không phải tên miền hợp lệ có ít nhất hai nhãn.
 */
export function normalizeHostname(input) {
  if (typeof input !== 'string') return null;
  let host = input.trim().toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (!host) return null;
  if (/[^\x00-\x7f]/.test(host)) {
    host = domainToASCII(host);
    if (!host) return null;
  }
  if (host.length > 253) return null;
  const labels = host.split('.');
  if (labels.length < 2) return null;
  for (const label of labels) {
    if (!LABEL.test(label)) return null;
  }
  return host;
}

/** Hostname và mọi tên miền cha theo ranh giới nhãn, từ cụ thể tới chung. */
export function hostnameSuffixes(host) {
  const labels = host.split('.');
  const out = [];
  for (let i = 0; i <= labels.length - 2; i += 1) {
    out.push(labels.slice(i).join('.'));
  }
  return out;
}

/** Đọc danh sách dạng mỗi dòng một tên miền, dòng bắt đầu bằng # là chú thích. */
export function parseDomainList(text) {
  const domains = new Set();
  let rejected = 0;
  let listVersion = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      const match = /^#\s*Version:\s*(\S+)/i.exec(line);
      if (match && !listVersion) listVersion = match[1];
      continue;
    }
    const host = normalizeHostname(line);
    if (host) domains.add(host);
    else rejected += 1;
  }
  return { domains, rejected, listVersion };
}
