// SPDX-License-Identifier: GPL-3.0-only
// Bộ ghi/đọc ZIP (không nén) và tar.gz tối thiểu, không phụ thuộc gói ngoài,
// cho kết quả giống nhau trên cùng đầu vào.
import zlib from 'node:zlib';

const DOS_TIME = 0;
const DOS_DATE = 0x0021; // 1980-01-01
const UTF8_FLAG = 0x0800;

/** entries: [{ name, data: Buffer }] — lưu nguyên, không nén. */
export function zipPack(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, end]);
}

/** Đọc ZIP do zipPack tạo ra. Từ chối mục có nén hoặc sai CRC. */
export function zipUnpack(zip) {
  const endAt = zip.length - 22;
  if (endAt < 0 || zip.readUInt32LE(endAt) !== 0x06054b50) throw new Error('zip: thiếu bản ghi kết thúc');
  const count = zip.readUInt16LE(endAt + 10);
  let at = zip.readUInt32LE(endAt + 16);
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    if (zip.readUInt32LE(at) !== 0x02014b50) throw new Error('zip: sai thư mục trung tâm');
    if (zip.readUInt16LE(at + 10) !== 0) throw new Error('zip: mục có nén không được hỗ trợ');
    const crc = zip.readUInt32LE(at + 16);
    const size = zip.readUInt32LE(at + 24);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const localAt = zip.readUInt32LE(at + 42);
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    if (zip.readUInt32LE(localAt) !== 0x04034b50) throw new Error('zip: sai header cục bộ');
    const dataAt = localAt + 30 + zip.readUInt16LE(localAt + 26) + zip.readUInt16LE(localAt + 28);
    const data = zip.subarray(dataAt, dataAt + size);
    if (data.length !== size || zlib.crc32(data) !== crc) throw new Error(`zip: sai CRC ở ${name}`);
    entries.push({ name, data });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function splitTarName(name) {
  if (Buffer.byteLength(name) <= 100) return { name, prefix: '' };
  for (let i = name.indexOf('/'); i !== -1; i = name.indexOf('/', i + 1)) {
    const prefix = name.slice(0, i);
    const rest = name.slice(i + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(rest) <= 100) return { name: rest, prefix };
  }
  throw new Error(`tar: đường dẫn quá dài: ${name}`);
}

/** entries: [{ name, data: Buffer }] — ustar, mtime 0, quyền 0644. */
export function tarGzPack(entries) {
  const blocks = [];
  for (const entry of entries) {
    const { name, prefix } = splitTarName(entry.name);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, 'utf8');
    header.write('0000644\0', 100, 'ascii');
    header.write('0000000\0', 108, 'ascii');
    header.write('0000000\0', 116, 'ascii');
    header.write(`${entry.data.length.toString(8).padStart(11, '0')}\0`, 124, 'ascii');
    header.write('00000000000\0', 136, 'ascii');
    header.write('        ', 148, 'ascii');
    header.write('0', 156, 'ascii');
    header.write('ustar\0', 257, 'ascii');
    header.write('00', 263, 'ascii');
    header.write(prefix, 345, 155, 'utf8');
    let sum = 0;
    for (const byte of header) sum += byte;
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
    blocks.push(header, entry.data, Buffer.alloc((512 - (entry.data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(blocks), { level: 9 });
}

export function tarGzUnpack(archive) {
  const tar = zlib.gunzipSync(archive);
  const entries = [];
  const text = (start, length) => {
    const slice = tar.subarray(start, start + length);
    const end = slice.indexOf(0);
    return slice.subarray(0, end === -1 ? length : end).toString('utf8');
  };
  for (let at = 0; at + 512 <= tar.length; ) {
    const name = text(at, 100);
    if (!name) break;
    const prefix = text(at + 345, 155);
    const size = parseInt(text(at + 124, 12).trim(), 8);
    const type = text(at + 156, 1);
    const data = tar.subarray(at + 512, at + 512 + size);
    if (data.length !== size) throw new Error('tar: file bị cắt cụt');
    if (type === '0' || type === '') entries.push({ name: prefix ? `${prefix}/${name}` : name, data });
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}
