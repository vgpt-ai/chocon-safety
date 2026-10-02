#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Tải (hoặc đọc lại) dữ liệu nguồn, tạo web-safety.bin, runtime.zip,
// corresponding-source.tar.gz và manifest.json có chữ ký.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { tarGzPack, zipPack } from './lib/archive.mjs';
import { FORMAT_VERSION, buildBin, lookup, parseBin } from './lib/bin.mjs';
import { normalizeHostname, parseDomainList } from './lib/domains.mjs';
import { MANIFEST_SCHEMA_VERSION, openManifest, sha256Hex, signManifest } from './lib/manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_PATTERN = /^data-\d{8}-\d{3}$/;
const MAX_SOURCE_BYTES = 64 * 1024 * 1024;
const MAX_REJECTED_RATIO = 0.01;
// Nội dung repo đi kèm gói nguồn tương ứng, để người nhận tự tạo lại gói hash.
const SOURCE_TREE = ['README.md', 'LICENSE', 'NOTICE.md', 'FORMAT.md', 'REBUILD.md', 'CONTRIBUTING.md', 'SECURITY.md', 'package.json', 'config', 'keys', 'scripts', 'tests', '.github'];

export function loadConfig(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, 'config/sources.json'), 'utf8'));
}

function upstreamFiles(config) {
  return [
    ...config.categories.map((category) => ({ category: category.name, path: category.path })),
    { category: null, path: config.upstream.licensePath },
  ];
}

async function download(url, headers = {}) {
  const response = await fetch(url, { headers, redirect: 'follow' });
  if (!response.ok) throw new Error(`Tải ${url} thất bại: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > MAX_SOURCE_BYTES) throw new Error(`${url} vượt giới hạn kích thước`);
  return data;
}

/** Tải dữ liệu upstream tại đúng một commit và ghi kèm upstream.json. */
export async function fetchSources(config, sourcesDir, { commit } = {}) {
  const { repository, branch } = config.upstream;
  let pinned = commit;
  if (!pinned) {
    const headers = { accept: 'application/vnd.github.sha', 'user-agent': 'chocon-safety-build' };
    if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    pinned = (await download(`https://api.github.com/repos/${repository}/commits/${branch}`, headers)).toString('utf8').trim();
  }
  if (!/^[0-9a-f]{40}$/.test(pinned)) throw new Error(`Commit upstream không hợp lệ: ${pinned}`);
  const files = [];
  for (const file of upstreamFiles(config)) {
    const url = `https://raw.githubusercontent.com/${repository}/${pinned}/${file.path}`;
    const data = await download(url);
    const target = path.join(sourcesDir, 'upstream', file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
    files.push({ ...file, url, bytes: data.length, sha256: sha256Hex(data) });
  }
  const upstream = { repository, commit: pinned, license: config.upstream.license, files };
  fs.writeFileSync(path.join(sourcesDir, 'upstream.json'), `${JSON.stringify(upstream, null, 2)}\n`);
  return upstream;
}

function readSources(config, sourcesDir) {
  const upstream = JSON.parse(fs.readFileSync(path.join(sourcesDir, 'upstream.json'), 'utf8'));
  const data = new Map();
  for (const expected of upstreamFiles(config)) {
    const record = upstream.files.find((file) => file.path === expected.path);
    if (!record) throw new Error(`upstream.json thiếu ${expected.path}`);
    const bytes = fs.readFileSync(path.join(sourcesDir, 'upstream', expected.path));
    if (sha256Hex(bytes) !== record.sha256) throw new Error(`${expected.path} không khớp sha256 trong upstream.json`);
    data.set(expected.path, bytes);
  }
  return { upstream, data };
}

function readHostList(root, file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const hosts = new Set();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const host = normalizeHostname(line);
    if (!host) throw new Error(`${file} có dòng không hợp lệ: ${line}`);
    hosts.add(host);
  }
  return hosts;
}

function walk(root, relative, out) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return;
  if (fs.statSync(absolute).isDirectory()) {
    for (const child of fs.readdirSync(absolute).sort()) walk(root, path.posix.join(relative, child), out);
  } else {
    out.push({ name: relative, data: fs.readFileSync(absolute) });
  }
}

function sourceNotice({ version, repository, upstream }) {
  return [
    '# Nguồn tương ứng của gói này',
    '',
    `Phiên bản dữ liệu: ${version}`,
    '',
    'File `web-safety.bin` trong gói này là bảng hash được tạo từ danh sách chặn',
    `NSFW và Gambling của HaGeZi (https://github.com/${upstream.repository}, commit`,
    `${upstream.commit}), phát hành theo GNU GPL phiên bản 3 (xem LICENSE).`,
    '',
    'Nguồn tương ứng đầy đủ của đúng phiên bản này (dữ liệu đầu vào, các điều',
    'chỉnh, script và hướng dẫn tạo lại) được cung cấp tại cùng nơi phát hành:',
    '',
    `https://github.com/${repository}/releases/download/${version}/corresponding-source.tar.gz`,
    '',
    `Trang phát hành: https://github.com/${repository}/releases/tag/${version}`,
    '',
  ].join('\n');
}

/**
 * Tạo bộ file phát hành trong outDir.
 * Trả về { changed: false } nếu bảng hash giống hệt bản trước và không ép buộc.
 */
export async function build({
  version,
  createdAt = new Date().toISOString(),
  outDir,
  sourcesDir,
  upstreamCommit,
  signingKeyPem,
  previousManifestText,
  force = false,
  root = ROOT,
  config = loadConfig(root),
  neverBlock = readHostList(root, 'config/never-block.txt'),
}) {
  if (!VERSION_PATTERN.test(version)) throw new Error(`Phiên bản phải có dạng data-YYYYMMDD-NNN: ${version}`);
  fs.mkdirSync(outDir, { recursive: true });

  let sources = sourcesDir;
  if (!sources) {
    sources = path.join(outDir, 'work/sources');
    fs.rmSync(sources, { recursive: true, force: true });
    fs.mkdirSync(sources, { recursive: true });
    await fetchSources(config, sources, { commit: upstreamCommit });
  }
  const { upstream, data } = readSources(config, sources);

  const allowlist = readHostList(root, 'config/allowlist.txt');
  const sections = [];
  const categories = [];
  for (const category of config.categories) {
    const parsed = parseDomainList(data.get(category.path).toString('utf8'));
    let allowlisted = 0;
    for (const host of allowlist) if (parsed.domains.delete(host)) allowlisted += 1;
    const total = parsed.domains.size + parsed.rejected;
    if (parsed.domains.size < category.minEntries) {
      throw new Error(`${category.name}: chỉ có ${parsed.domains.size} mục, dưới ngưỡng ${category.minEntries}`);
    }
    if (parsed.rejected > total * MAX_REJECTED_RATIO) {
      throw new Error(`${category.name}: ${parsed.rejected} dòng không hợp lệ, vượt ngưỡng cho phép`);
    }
    sections.push({ id: category.id, domains: parsed.domains });
    categories.push({ id: category.id, name: category.name, rejectedLines: parsed.rejected, allowlisted, listVersion: parsed.listVersion });
  }
  const { bin, counts } = buildBin(sections);
  for (const category of categories) category.entries = counts.find((count) => count.id === category.id).entries;
  const binSha256 = sha256Hex(bin);

  const parsedBin = parseBin(bin);
  const wronglyBlocked = [...neverBlock].filter((host) => lookup(bin, parsedBin, host) !== 0);
  if (wronglyBlocked.length > 0) {
    throw new Error(`Dữ liệu upstream chặn tên miền trong config/never-block.txt: ${wronglyBlocked.join(', ')}`);
  }

  if (previousManifestText && !force) {
    const previous = openManifest(previousManifestText, { allowUnsigned: true }).payload;
    if (previous.runtime?.bin?.sha256 === binSha256) return { changed: false, binSha256, previousVersion: previous.version };
  }

  const repository = config.distribution.repository;
  const releaseBase = `https://github.com/${repository}/releases/download/${version}`;
  const read = (name) => fs.readFileSync(path.join(root, name));

  const runtimeZip = zipPack([
    { name: 'web-safety.bin', data: bin },
    { name: 'LICENSE', data: read('LICENSE') },
    { name: 'NOTICE.md', data: read('NOTICE.md') },
    { name: 'SOURCE.md', data: Buffer.from(sourceNotice({ version, repository, upstream }), 'utf8') },
  ]);

  const tree = [];
  for (const entry of SOURCE_TREE) walk(root, entry, tree);
  const snapshot = [];
  walk(sources, 'upstream.json', snapshot);
  walk(sources, 'upstream', snapshot);
  const prefix = `chocon-safety-${version}`;
  const sourceEntries = [
    ...tree,
    ...snapshot.map((entry) => ({ name: `sources/${entry.name}`, data: entry.data })),
    { name: 'build-info.json', data: Buffer.from(`${JSON.stringify({ version, createdAt }, null, 2)}\n`, 'utf8') },
  ]
    .map((entry) => ({ name: `${prefix}/${entry.name}`, data: entry.data }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  const sourceTarGz = tarGzPack(sourceEntries);

  const payload = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    version,
    createdAt,
    format: { name: 'chocon-web-safety-bin', version: FORMAT_VERSION, hash: 'sha256-trunc64' },
    runtime: {
      file: 'runtime.zip',
      url: `${releaseBase}/runtime.zip`,
      size: runtimeZip.length,
      sha256: sha256Hex(runtimeZip),
      bin: { file: 'web-safety.bin', size: bin.length, sha256: binSha256, categories: categories.map(({ id, name, entries }) => ({ id, name, entries })) },
    },
    correspondingSource: {
      file: 'corresponding-source.tar.gz',
      url: `${releaseBase}/corresponding-source.tar.gz`,
      size: sourceTarGz.length,
      sha256: sha256Hex(sourceTarGz),
    },
    upstream: {
      repository: upstream.repository,
      commit: upstream.commit,
      license: upstream.license,
      files: upstream.files.map(({ category, path: filePath, sha256, bytes }) => ({ category, path: filePath, sha256, bytes })),
      lists: categories.map(({ name, listVersion, rejectedLines, allowlisted }) => ({ name, listVersion, rejectedLines, allowlisted })),
    },
    license: 'GPL-3.0-only',
  };

  fs.writeFileSync(path.join(outDir, 'runtime.zip'), runtimeZip);
  fs.writeFileSync(path.join(outDir, 'corresponding-source.tar.gz'), sourceTarGz);
  fs.writeFileSync(path.join(outDir, 'manifest.json'), signManifest(payload, signingKeyPem));
  return { changed: true, binSha256, payload };
}

async function main() {
  const { values } = parseArgs({
    options: {
      version: { type: 'string' },
      out: { type: 'string', default: 'dist' },
      'sources-dir': { type: 'string' },
      'build-info': { type: 'string' },
      'upstream-commit': { type: 'string' },
      'signing-key-file': { type: 'string' },
      'previous-manifest': { type: 'string' },
      unsigned: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
    },
  });
  const info = values['build-info'] ? JSON.parse(fs.readFileSync(values['build-info'], 'utf8')) : {};
  const version = values.version ?? info.version;
  if (!version) throw new Error('Thiếu --version (hoặc --build-info)');

  let signingKeyPem = process.env.WEB_SAFETY_SIGNING_KEY || undefined;
  if (values['signing-key-file']) signingKeyPem = fs.readFileSync(values['signing-key-file'], 'utf8');
  if (values.unsigned) signingKeyPem = undefined;
  else if (!signingKeyPem) throw new Error('Thiếu khóa ký (WEB_SAFETY_SIGNING_KEY hoặc --signing-key-file); dùng --unsigned để thử cục bộ');

  const previousPath = values['previous-manifest'];
  const previousManifestText = previousPath && fs.existsSync(previousPath) && fs.statSync(previousPath).size > 0 ? fs.readFileSync(previousPath, 'utf8') : undefined;

  const result = await build({
    version,
    createdAt: info.createdAt,
    outDir: path.resolve(values.out),
    sourcesDir: values['sources-dir'] ? path.resolve(values['sources-dir']) : undefined,
    upstreamCommit: values['upstream-commit'],
    signingKeyPem,
    previousManifestText,
    force: values.force,
  });
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${result.changed}\n`);
  if (!result.changed) {
    console.log(`Bảng hash không đổi so với ${result.previousVersion} (${result.binSha256}); không tạo bản mới.`);
    return;
  }
  const { runtime, correspondingSource, upstream } = result.payload;
  console.log(`Đã tạo ${version}${signingKeyPem ? '' : ' (CHƯA KÝ)'}`);
  console.log(`  upstream ${upstream.repository}@${upstream.commit}`);
  for (const category of runtime.bin.categories) console.log(`  ${category.name}: ${category.entries} mục`);
  console.log(`  web-safety.bin ${runtime.bin.size} byte sha256=${runtime.bin.sha256}`);
  console.log(`  runtime.zip ${runtime.size} byte, corresponding-source.tar.gz ${correspondingSource.size} byte`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
