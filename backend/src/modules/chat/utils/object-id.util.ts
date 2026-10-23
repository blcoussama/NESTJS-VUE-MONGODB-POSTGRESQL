// Strict check: exactly 24 hex characters (mongoose's isValid also accepts any
// 12-character string, which is not a valid user id for this API).
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}
