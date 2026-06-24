import { createHmac, timingSafeEqual } from 'crypto';

/** Signs/verifies local-storage upload & download URLs so they behave like S3 presigned URLs (no auth header needed). */
export function signLocalStorageUrl(
  key: string,
  expiry: number,
  secret: string,
): string {
  return createHmac('sha256', secret).update(`${key}:${expiry}`).digest('hex');
}

export function verifyLocalStorageUrl(
  key: string,
  expiry: number,
  signature: string,
  secret: string,
): boolean {
  if (Date.now() / 1000 > expiry) return false;
  const expected = signLocalStorageUrl(key, expiry, secret);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  return (
    expectedBuf.length === actualBuf.length &&
    timingSafeEqual(expectedBuf, actualBuf)
  );
}

export function encodeKey(key: string): string {
  return Buffer.from(key, 'utf8').toString('base64url');
}

export function decodeKey(encoded: string): string {
  return Buffer.from(encoded, 'base64url').toString('utf8');
}
