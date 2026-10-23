import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** SHA-256 hex digest. Suitable for high-entropy secrets (random tokens, JWTs). */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex digests (false on length mismatch). */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Cryptographically random token (hex), e.g. for email verification links. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
