// SPDX-License-Identifier: GPL-3.0-only
// Định dạng web-safety.bin phiên bản 1. Mô tả đầy đủ: FORMAT.md.
import { createHash } from 'node:crypto';
import { hostnameSuffixes, normalizeHostname } from './domains.mjs';

export const MAGIC = Buffer.from('CHCNWSD1', 'ascii');
export const FORMAT_VERSION = 1;
export const HASH_ALGORITHM_SHA256_TRUNC = 1;
export const HASH_LENGTH = 8;
const HEADER_LENGTH = 16;
const SECTION_ENTRY_LENGTH = 16;
const TRAILER_LENGTH = 32;

export function hashDomain(domain) {
  return createHash('sha256').update(domain, 'utf8').digest().subarray(0, HASH_LENGTH);
}

function sortedUniqueHashes(domains) {
  const values = new BigUint64Array(domains.size);
  let i = 0;
  for (const domain of domains) {
    values[i] = hashDomain(domain).readBigUInt64BE(0);
    i += 1;
  }
  values.sort();
  const out = Buffer.alloc(values.length * HASH_LENGTH);
  let count = 0;
  let previous = null;
  for (const value of values) {
    if (value === previous) continue;
    out.writeBigUInt64BE(value, count * HASH_LENGTH);
    previous = value;
    count += 1;
  }
  return { data: out.subarray(0, count * HASH_LENGTH), count };
}

/** sections: [{ id, domains: Set<string> }] */
export function buildBin(sections) {
  const ordered = [...sections].sort((a, b) => a.id - b.id);
  const header = Buffer.alloc(HEADER_LENGTH + ordered.length * SECTION_ENTRY_LENGTH);
  MAGIC.copy(header, 0);
  header.writeUInt16BE(FORMAT_VERSION, 8);
  header.writeUInt8(HASH_ALGORITHM_SHA256_TRUNC, 10);
  header.writeUInt8(HASH_LENGTH, 11);
  header.writeUInt16BE(ordered.length, 12);
  const parts = [header];
  const counts = [];
  let offset = header.length;
  ordered.forEach((section, index) => {
    const { data, count } = sortedUniqueHashes(section.domains);
    const at = HEADER_LENGTH + index * SECTION_ENTRY_LENGTH;
    header.writeUInt16BE(section.id, at);
    header.writeUInt32BE(count, at + 4);
    header.writeBigUInt64BE(BigInt(offset), at + 8);
    parts.push(data);
    counts.push({ id: section.id, entries: count });
    offset += data.length;
  });
  const body = Buffer.concat(parts);
  const trailer = createHash('sha256').update(body).digest();
  return { bin: Buffer.concat([body, trailer]), counts };
}

/** Kiểm cấu trúc và trả về bảng section. Ném lỗi nếu file không hợp lệ. */
export function parseBin(bin) {
  if (bin.length < HEADER_LENGTH + TRAILER_LENGTH) throw new Error('bin: quá ngắn');
  if (!bin.subarray(0, 8).equals(MAGIC)) throw new Error('bin: sai magic');
  if (bin.readUInt16BE(8) !== FORMAT_VERSION) throw new Error('bin: phiên bản định dạng không hỗ trợ');
  if (bin.readUInt8(10) !== HASH_ALGORITHM_SHA256_TRUNC) throw new Error('bin: thuật toán hash không hỗ trợ');
  if (bin.readUInt8(11) !== HASH_LENGTH) throw new Error('bin: độ dài hash không hỗ trợ');
  const sectionCount = bin.readUInt16BE(12);
  const bodyLength = bin.length - TRAILER_LENGTH;
  const digest = createHash('sha256').update(bin.subarray(0, bodyLength)).digest();
  if (!digest.equals(bin.subarray(bodyLength))) throw new Error('bin: sai mã toàn vẹn cuối file');
  let expectedOffset = HEADER_LENGTH + sectionCount * SECTION_ENTRY_LENGTH;
  if (expectedOffset > bodyLength) throw new Error('bin: bảng section vượt kích thước file');
  const sections = [];
  let previousId = 0;
  for (let i = 0; i < sectionCount; i += 1) {
    const at = HEADER_LENGTH + i * SECTION_ENTRY_LENGTH;
    const id = bin.readUInt16BE(at);
    const count = bin.readUInt32BE(at + 4);
    const offset = Number(bin.readBigUInt64BE(at + 8));
    if (id <= previousId) throw new Error('bin: section không tăng dần theo id');
    if (offset !== expectedOffset) throw new Error('bin: offset section không liền mạch');
    expectedOffset = offset + count * HASH_LENGTH;
    if (expectedOffset > bodyLength) throw new Error('bin: section vượt kích thước file');
    previousId = id;
    sections.push({ id, count, offset });
  }
  if (expectedOffset !== bodyLength) throw new Error('bin: có dữ liệu thừa');
  return { sections };
}

/** Kiểm từng section tăng chặt (đã sắp xếp, không trùng). Chỉ dùng khi xác minh bản phát hành. */
export function assertSorted(bin, parsed) {
  for (const section of parsed.sections) {
    let previous = -1n;
    for (let i = 0; i < section.count; i += 1) {
      const value = bin.readBigUInt64BE(section.offset + i * HASH_LENGTH);
      if (value <= previous) throw new Error(`bin: section ${section.id} không tăng chặt tại ${i}`);
      previous = value;
    }
  }
}

function sectionHas(bin, section, needle) {
  let low = 0;
  let high = section.count - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const value = bin.readBigUInt64BE(section.offset + mid * HASH_LENGTH);
    if (value === needle) return true;
    if (value < needle) low = mid + 1;
    else high = mid - 1;
  }
  return false;
}

/**
 * Tra hostname trong bảng hash. Một mục trong danh sách chặn cả tên miền đó
 * lẫn mọi tên miền con. Trả về id danh mục khớp đầu tiên, hoặc 0 nếu không khớp.
 */
export function lookup(bin, parsed, hostname) {
  const host = normalizeHostname(hostname);
  if (!host) return 0;
  for (const suffix of hostnameSuffixes(host)) {
    const needle = hashDomain(suffix).readBigUInt64BE(0);
    for (const section of parsed.sections) {
      if (sectionHas(bin, section, needle)) return section.id;
    }
  }
  return 0;
}
