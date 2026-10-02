#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// In ghi chú phát hành (Markdown) từ manifest trong thư mục dist.
import fs from 'node:fs';
import path from 'node:path';
import { openManifest } from './lib/manifest.mjs';

const dir = process.argv[2] ?? 'dist';
const { payload } = openManifest(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'), { allowUnsigned: true });
const { version, runtime, correspondingSource, upstream } = payload;
const lists = runtime.bin.categories
  .map((category) => {
    const list = upstream.lists.find((item) => item.name === category.name);
    return `- ${category.name}: ${category.entries} mục (HaGeZi ${list.listVersion ?? 'không rõ phiên bản'})`;
  })
  .join('\n');

console.log(`Gói hash an toàn web của Chocon, phiên bản \`${version}\`.

Dữ liệu được tạo từ danh sách chặn của [HaGeZi](https://github.com/${upstream.repository}) tại commit \`${upstream.commit}\`, phát hành theo GNU GPL phiên bản 3.

${lists}

| File | Nội dung | sha256 |
|---|---|---|
| \`manifest.json\` | Thông tin phiên bản, checksum và chữ ký Ed25519 | |
| \`runtime.zip\` | \`web-safety.bin\` (bảng hash, không chứa tên miền dạng rõ) cùng LICENSE, NOTICE, chỉ dẫn lấy nguồn | \`${runtime.sha256}\` |
| \`corresponding-source.tar.gz\` | **Nguồn tương ứng** của đúng bản này: dữ liệu đầu vào từ HaGeZi, các điều chỉnh, script và hướng dẫn tạo lại | \`${correspondingSource.sha256}\` |

Gói nguồn chứa danh sách tên miền gốc và chỉ dành cho người chủ động tải. Ứng dụng Chocon chỉ tải \`manifest.json\` và \`runtime.zip\`.

Tạo lại và đối chiếu: xem \`REBUILD.md\` trong gói nguồn.

Lưu ý: mục "Source code (zip/tar.gz)" do GitHub tự tạo chỉ chứa công cụ, không chứa dữ liệu đầu vào. Nguồn tương ứng đầy đủ là \`corresponding-source.tar.gz\`.`);
