#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Xác minh một bộ file phát hành: chữ ký manifest, checksum, cấu trúc gói
// runtime, gói nguồn tương ứng và (tùy chọn) tạo lại bảng hash từ gói nguồn.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { tarGzUnpack, zipUnpack } from './lib/archive.mjs';
import { assertSorted, parseBin } from './lib/bin.mjs';
import { openManifest, sha256Hex } from './lib/manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME_FILES = ['web-safety.bin', 'LICENSE', 'NOTICE.md', 'SOURCE.md'];

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function checkAsset(dir, record, label) {
  const data = fs.readFileSync(path.join(dir, record.file));
  check(data.length === record.size, `${label}: sai kích thước`);
  check(sha256Hex(data) === record.sha256, `${label}: sai sha256`);
  return data;
}

export function verifyRelease(dir, { publicKeyPems = [], allowUnsigned = false, expectVersion, rebuild = false } = {}) {
  const manifestText = fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8');
  const { payload, signed } = openManifest(manifestText, { publicKeyPems, allowUnsigned });
  const { version, runtime, correspondingSource, upstream } = payload;
  if (expectVersion) check(version === expectVersion, `manifest: phiên bản ${version} khác ${expectVersion}`);
  for (const record of [runtime, correspondingSource]) {
    check(record.url.endsWith(`/releases/download/${version}/${record.file}`), `manifest: URL ${record.file} không gắn với đúng phiên bản`);
  }

  const runtimeEntries = zipUnpack(checkAsset(dir, runtime, 'runtime.zip'));
  check(
    runtimeEntries.map((entry) => entry.name).join() === RUNTIME_FILES.join(),
    'runtime.zip: danh sách file không đúng (không được chứa gì ngoài bảng hash và thông báo pháp lý)',
  );
  const bin = runtimeEntries[0].data;
  check(bin.length === runtime.bin.size && sha256Hex(bin) === runtime.bin.sha256, 'web-safety.bin: không khớp manifest');
  const parsed = parseBin(bin);
  assertSorted(bin, parsed);
  check(
    JSON.stringify(parsed.sections.map(({ id, count }) => [id, count])) === JSON.stringify(runtime.bin.categories.map(({ id, entries }) => [id, entries])),
    'web-safety.bin: số mục theo danh mục không khớp manifest',
  );
  check(runtimeEntries[3].data.toString('utf8').includes(correspondingSource.url), 'SOURCE.md: thiếu đường dẫn nguồn tương ứng');

  const sourceArchive = checkAsset(dir, correspondingSource, 'corresponding-source.tar.gz');
  const sourceEntries = tarGzUnpack(sourceArchive);
  const prefix = `chocon-safety-${version}/`;
  const byName = new Map(sourceEntries.map((entry) => [entry.name, entry.data]));
  for (const file of upstream.files) {
    const data = byName.get(`${prefix}sources/upstream/${file.path}`);
    check(data && sha256Hex(data) === file.sha256, `gói nguồn: thiếu hoặc sai ${file.path}`);
  }
  for (const required of ['LICENSE', 'REBUILD.md', 'build-info.json', 'scripts/build.mjs', 'config/sources.json', 'config/allowlist.txt', 'sources/upstream.json']) {
    check(byName.has(prefix + required), `gói nguồn: thiếu ${required}`);
  }

  if (rebuild) {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'chocon-safety-rebuild-'));
    try {
      for (const entry of sourceEntries) {
        const target = path.join(work, entry.name);
        check(target.startsWith(work + path.sep), `gói nguồn: đường dẫn không an toàn ${entry.name}`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, entry.data);
      }
      const tree = path.join(work, prefix);
      execFileSync(
        process.execPath,
        ['scripts/build.mjs', '--sources-dir', 'sources', '--build-info', 'build-info.json', '--unsigned', '--out', 'rebuilt'],
        { cwd: tree, stdio: 'pipe', env: { ...process.env, WEB_SAFETY_SIGNING_KEY: '', GITHUB_OUTPUT: '' } },
      );
      const rebuilt = fs.readFileSync(path.join(tree, 'rebuilt/runtime.zip'));
      check(sha256Hex(rebuilt) === runtime.sha256, 'tạo lại từ gói nguồn: runtime.zip khác bản phát hành');
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }
  return { payload, signed, rebuilt: rebuild };
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'public-key': { type: 'string', multiple: true },
      'allow-unsigned': { type: 'boolean', default: false },
      'expect-version': { type: 'string' },
      rebuild: { type: 'boolean', default: false },
    },
  });
  const dir = path.resolve(positionals[0] ?? 'dist');
  const keyFiles = values['public-key'] ?? [path.join(ROOT, 'keys/web-safety-ed25519.pub.pem')];
  const result = verifyRelease(dir, {
    publicKeyPems: keyFiles.map((file) => fs.readFileSync(file, 'utf8')),
    allowUnsigned: values['allow-unsigned'],
    expectVersion: values['expect-version'],
    rebuild: values.rebuild,
  });
  const { version, runtime } = result.payload;
  console.log(`OK ${version}: chữ ký ${result.signed ? 'hợp lệ' : 'KHÔNG CÓ (cho phép)'}, checksum và cấu trúc khớp${result.rebuilt ? ', tạo lại từ nguồn khớp từng byte' : ''}.`);
  for (const category of runtime.bin.categories) console.log(`  ${category.name}: ${category.entries} mục`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  }
}
