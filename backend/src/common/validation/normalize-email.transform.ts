import { Transform } from 'class-transformer';

/** Trims and lowercases an email so lookups match the stored (lowercased) value. */
export function NormalizeEmail() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
}
