/**
 * Detects the real type of an uploaded file from its first bytes ("magic
 * numbers") instead of trusting the client-declared Content-Type.
 */
export type DetectedFileType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'application/pdf';

export const IMAGE_TYPES: readonly DetectedFileType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const PDF_TYPES: readonly DetectedFileType[] = ['application/pdf'];

/** File extension used for the S3 key of each accepted type. */
export const FILE_EXTENSIONS: Record<DetectedFileType, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => buffer[offset + i] === byte);
}

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

export function detectFileType(
  buffer: Buffer | undefined,
): DetectedFileType | null {
  if (!buffer || buffer.length < 4) return null;

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, PNG_SIGNATURE)) return 'image/png';
  if (startsWith(buffer, ascii('RIFF')) && startsWith(buffer, ascii('WEBP'), 8))
    return 'image/webp';
  if (startsWith(buffer, ascii('%PDF-'))) return 'application/pdf';

  return null;
}
