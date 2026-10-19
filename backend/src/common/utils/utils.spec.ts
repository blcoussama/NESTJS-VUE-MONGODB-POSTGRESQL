import { randomToken, safeEqualHex, sha256 } from './crypto.util';
import { maskEmail } from './mask-email.util';

describe('crypto utils', () => {
  it('sha256 is deterministic and hex encoded', () => {
    expect(sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('safeEqualHex compares digests in constant time', () => {
    expect(safeEqualHex(sha256('a'), sha256('a'))).toBe(true);
    expect(safeEqualHex(sha256('a'), sha256('b'))).toBe(false);
    expect(safeEqualHex(sha256('a'), 'abcd')).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
  });

  it('randomToken returns 64 hex chars and never repeats', () => {
    const a = randomToken();
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(randomToken()).not.toBe(a);
  });
});

describe('maskEmail', () => {
  it('masks the local part', () => {
    expect(maskEmail('oussama@example.com')).toBe('o***@example.com');
    expect(maskEmail('invalid')).toBe('***');
  });
});
