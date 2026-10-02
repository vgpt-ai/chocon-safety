// SPDX-License-Identifier: GPL-3.0-only
// manifest.json là một phong bì: `payload` là chuỗi JSON được ký nguyên văn
// (UTF-8), `signature` là chữ ký Ed25519 trên đúng các byte đó.
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export const MANIFEST_SCHEMA_VERSION = 1;

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function keyIdOf(publicKey) {
  return sha256Hex(publicKey.export({ type: 'spki', format: 'der' })).slice(0, 16);
}

export function signManifest(payloadObject, privateKeyPem) {
  const payload = JSON.stringify(payloadObject);
  const envelope = { payload };
  if (privateKeyPem) {
    const privateKey = createPrivateKey(privateKeyPem);
    if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('Khóa ký phải là Ed25519');
    envelope.signature = {
      algorithm: 'ed25519',
      keyId: keyIdOf(createPublicKey(privateKey)),
      value: sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64'),
    };
  }
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

/**
 * Xác minh phong bì và trả về payload đã parse.
 * publicKeyPems: danh sách khóa công khai đã tin cậy từ trước (không lấy từ bản phát hành).
 */
export function openManifest(manifestText, { publicKeyPems = [], allowUnsigned = false } = {}) {
  const envelope = JSON.parse(manifestText);
  if (typeof envelope.payload !== 'string') throw new Error('manifest: thiếu payload');
  let signed = false;
  if (envelope.signature) {
    const { algorithm, value } = envelope.signature;
    if (algorithm !== 'ed25519' || typeof value !== 'string') throw new Error('manifest: chữ ký không hỗ trợ');
    const message = Buffer.from(envelope.payload, 'utf8');
    const signature = Buffer.from(value, 'base64');
    signed = publicKeyPems.some((pem) => verify(null, message, createPublicKey(pem), signature));
    if (!signed && !allowUnsigned) throw new Error('manifest: chữ ký không khớp khóa công khai đã tin cậy');
  } else if (!allowUnsigned) {
    throw new Error('manifest: chưa được ký');
  }
  const payload = JSON.parse(envelope.payload);
  if (payload.schemaVersion !== MANIFEST_SCHEMA_VERSION) throw new Error('manifest: schemaVersion không hỗ trợ');
  return { payload, signed };
}
