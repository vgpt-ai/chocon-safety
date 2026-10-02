// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { build, loadConfig } from '../scripts/build.mjs';
import { zipUnpack } from '../scripts/lib/archive.mjs';
import { lookup, parseBin } from '../scripts/lib/bin.mjs';
import { sha256Hex } from '../scripts/lib/manifest.mjs';
import { verifyRelease } from '../scripts/verify.mjs';

const LISTS = {
  'wildcard/nsfw-onlydomains.txt': '# Version: 1.0\nadult.example\nvideo.adult.test\n',
  'wildcard/gambling-onlydomains.txt': '# Version: 2.0\nbet.example\ncasino.test\n',
  LICENSE: 'GPL-3.0 (giả lập cho test)\n',
};

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chocon-safety-test-'));
  const sources = path.join(dir, 'sources');
  const config = loadConfig();
  for (const category of config.categories) category.minEntries = 1;
  const files = [];
  for (const [file, text] of Object.entries(LISTS)) {
    const target = path.join(sources, 'upstream', file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
    files.push({ category: null, path: file, url: `https://example.invalid/${file}`, bytes: Buffer.byteLength(text), sha256: sha256Hex(text) });
  }
  fs.writeFileSync(path.join(sources, 'upstream.json'), JSON.stringify({ repository: 'hagezi/dns-blocklists', commit: 'a'.repeat(40), license: 'GPL-3.0', files }));
  const keys = generateKeyPairSync('ed25519');
  return {
    dir,
    sources,
    config,
    signingKeyPem: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKeyPems: [keys.publicKey.export({ type: 'spki', format: 'pem' })],
  };
}

test('build tạo bộ phát hành mà verify chấp nhận', async (t) => {
  const f = fixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  const outDir = path.join(f.dir, 'dist');
  const options = { version: 'data-20260101-001', createdAt: '2026-01-01T00:00:00.000Z', outDir, sourcesDir: f.sources, signingKeyPem: f.signingKeyPem, config: f.config };
  const result = await build(options);
  assert.equal(result.changed, true);
  assert.deepEqual(fs.readdirSync(outDir).sort(), ['corresponding-source.tar.gz', 'manifest.json', 'runtime.zip']);

  const verified = verifyRelease(outDir, { publicKeyPems: f.publicKeyPems, expectVersion: 'data-20260101-001' });
  assert.equal(verified.signed, true);
  assert.deepEqual(verified.payload.runtime.bin.categories, [
    { id: 1, name: 'nsfw', entries: 2 },
    { id: 2, name: 'gambling', entries: 2 },
  ]);

  const runtimeZip = fs.readFileSync(path.join(outDir, 'runtime.zip'));
  for (const plain of ['adult.example', 'casino.test']) assert.equal(runtimeZip.includes(plain), false, 'runtime.zip không chứa tên miền dạng rõ');
  const bin = zipUnpack(runtimeZip)[0].data;
  assert.equal(lookup(bin, parseBin(bin), 'm.bet.example'), 2);

  await t.test('bảng hash không đổi thì không tạo bản mới', async () => {
    const previousManifestText = fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8');
    const again = await build({ ...options, version: 'data-20260102-001', outDir: path.join(f.dir, 'dist2'), previousManifestText });
    assert.deepEqual([again.changed, again.previousVersion], [false, 'data-20260101-001']);
    const forced = await build({ ...options, version: 'data-20260102-001', outDir: path.join(f.dir, 'dist2'), previousManifestText, force: true });
    assert.equal(forced.changed, true);
  });

  await t.test('verify phát hiện file bị thay', () => {
    assert.throws(() => verifyRelease(outDir, { publicKeyPems: f.publicKeyPems, expectVersion: 'data-20260101-002' }), /phiên bản/);
    const file = path.join(outDir, 'runtime.zip');
    const changed = Buffer.from(runtimeZip);
    changed[100] ^= 1;
    fs.writeFileSync(file, changed);
    assert.throws(() => verifyRelease(outDir, { publicKeyPems: f.publicKeyPems }), /runtime.zip: sai sha256/);
    fs.writeFileSync(file, runtimeZip);
  });
});

test('build dừng khi dữ liệu upstream bị hụt hoặc bị sửa', async (t) => {
  const f = fixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  const options = { version: 'data-20260101-001', outDir: path.join(f.dir, 'dist'), sourcesDir: f.sources, config: f.config };
  f.config.categories[1].minEntries = 3;
  await assert.rejects(build(options), /gambling: chỉ có 2 mục/);
  f.config.categories[1].minEntries = 1;
  fs.appendFileSync(path.join(f.sources, 'upstream/wildcard/nsfw-onlydomains.txt'), 'extra.example\n');
  await assert.rejects(build(options), /không khớp sha256/);
  await assert.rejects(build({ ...options, version: 'v1' }), /data-YYYYMMDD-NNN/);
});

test('build dừng khi một tên miền không được phép chặn bị khớp', async (t) => {
  const f = fixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  const options = { version: 'data-20260101-001', outDir: path.join(f.dir, 'dist'), sourcesDir: f.sources, config: f.config };
  await assert.rejects(build({ ...options, neverBlock: new Set(['school.example', 'lop5.bet.example']) }), /never-block.txt: lop5.bet.example$/);
  assert.equal(fs.existsSync(path.join(f.dir, 'dist/runtime.zip')), false);
  assert.equal((await build({ ...options, neverBlock: new Set(['school.example']) })).changed, true);
});
