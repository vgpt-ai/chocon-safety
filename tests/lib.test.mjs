// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { tarGzPack, tarGzUnpack, zipPack, zipUnpack } from '../scripts/lib/archive.mjs';
import { assertSorted, buildBin, lookup, parseBin } from '../scripts/lib/bin.mjs';
import { hostnameSuffixes, normalizeHostname, parseDomainList } from '../scripts/lib/domains.mjs';
import { openManifest, signManifest } from '../scripts/lib/manifest.mjs';

test('chuẩn hóa hostname', () => {
  assert.equal(normalizeHostname(' WWW.Example.COM. '), 'www.example.com');
  assert.equal(normalizeHostname('bücher.example'), 'xn--bcher-kva.example');
  for (const bad of ['', 'localhost', 'a..b', '-a.com', 'a b.com', 'http://a.com', 'a.com/x', '*.a.com', `${'a'.repeat(64)}.com`, null]) {
    assert.equal(normalizeHostname(bad), null, String(bad));
  }
  assert.deepEqual(hostnameSuffixes('a.b.example.com'), ['a.b.example.com', 'b.example.com', 'example.com']);
});

test('đọc danh sách tên miền', () => {
  const parsed = parseDomainList('# Title: x\n# Version: 2026.1.2\n\nA.example\nb.example\r\na.example\nnot a domain\n');
  assert.deepEqual([...parsed.domains], ['a.example', 'b.example']);
  assert.equal(parsed.rejected, 1);
  assert.equal(parsed.listVersion, '2026.1.2');
});

test('bảng hash: tạo, đọc và tra cứu', () => {
  const { bin, counts } = buildBin([
    { id: 2, domains: new Set(['bet.example', 'casino.test']) },
    { id: 1, domains: new Set(['adult.example', 'x.sub.example']) },
  ]);
  assert.deepEqual(counts, [{ id: 1, entries: 2 }, { id: 2, entries: 2 }]);
  const parsed = parseBin(bin);
  assertSorted(bin, parsed);
  assert.equal(lookup(bin, parsed, 'adult.example'), 1);
  assert.equal(lookup(bin, parsed, 'WWW.Adult.Example.'), 1, 'tên miền con và chữ hoa');
  assert.equal(lookup(bin, parsed, 'a.b.casino.test'), 2);
  assert.equal(lookup(bin, parsed, 'sub.example'), 0, 'tên miền cha của một mục không bị chặn');
  assert.equal(lookup(bin, parsed, 'notadult.example'), 0, 'chỉ khớp theo ranh giới nhãn');
  assert.equal(lookup(bin, parsed, 'example'), 0);
  assert.equal(bin.includes('adult'), false, 'không có tên miền dạng rõ');
});

test('bảng hash: từ chối file hỏng', () => {
  const { bin } = buildBin([{ id: 1, domains: new Set(['adult.example']) }]);
  const flipped = Buffer.from(bin);
  flipped[40] ^= 1;
  assert.throws(() => parseBin(flipped), /toàn vẹn/);
  assert.throws(() => parseBin(bin.subarray(0, bin.length - 1)), /bin:/);
  const wrongMagic = Buffer.from(bin);
  wrongMagic[0] = 0;
  assert.throws(() => parseBin(wrongMagic), /magic/);
});

test('zip và tar.gz: ghi rồi đọc lại, kết quả ổn định', () => {
  const entries = [
    { name: 'a.txt', data: Buffer.from('xin chào') },
    { name: `${'thu-muc-dai/'.repeat(9)}tep.bin`, data: Buffer.alloc(1500, 7) },
    { name: 'empty', data: Buffer.alloc(0) },
  ];
  assert.deepEqual(zipUnpack(zipPack(entries)), entries);
  assert.deepEqual(tarGzUnpack(tarGzPack(entries)), entries);
  assert.ok(zipPack(entries).equals(zipPack(entries)));
  const broken = zipPack(entries);
  broken[35] ^= 1;
  assert.throws(() => zipUnpack(broken), /CRC/);
});

test('manifest: ký và xác minh', () => {
  const pem = (key, type) => key.export({ type, format: 'pem' });
  const trusted = generateKeyPairSync('ed25519');
  const other = generateKeyPairSync('ed25519');
  const text = signManifest({ schemaVersion: 1, version: 'data-20260101-001' }, pem(trusted.privateKey, 'pkcs8'));
  const trustedPems = [pem(trusted.publicKey, 'spki')];
  assert.equal(openManifest(text, { publicKeyPems: trustedPems }).payload.version, 'data-20260101-001');
  assert.throws(() => openManifest(text, { publicKeyPems: [pem(other.publicKey, 'spki')] }), /chữ ký/);
  assert.throws(() => openManifest(text, { publicKeyPems: [] }), /chữ ký/);
  const tampered = JSON.parse(text);
  tampered.payload = tampered.payload.replace('001', '002');
  assert.throws(() => openManifest(JSON.stringify(tampered), { publicKeyPems: trustedPems }), /chữ ký/);
  const unsigned = signManifest({ schemaVersion: 1 }, undefined);
  assert.throws(() => openManifest(unsigned, { publicKeyPems: trustedPems }), /chưa được ký/);
  assert.equal(openManifest(unsigned, { allowUnsigned: true }).signed, false);
});
