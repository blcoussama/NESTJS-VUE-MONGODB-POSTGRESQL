import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import {
  DetectedFileType,
  detectFileType,
  IMAGE_TYPES,
  PDF_TYPES,
} from './file-signature';

export interface UploadRule {
  /** Human-readable label used in error messages. */
  label: string;
  maxBytes: number;
  allowedTypes: readonly DetectedFileType[];
}

const MB = 1024 * 1024;

export const AVATAR_UPLOAD: UploadRule = {
  label: 'Avatar',
  maxBytes: 2 * MB,
  allowedTypes: IMAGE_TYPES,
};

export const LOGO_UPLOAD: UploadRule = {
  label: 'Logo',
  maxBytes: 2 * MB,
  allowedTypes: IMAGE_TYPES,
};

export const CV_UPLOAD: UploadRule = {
  label: 'CV',
  maxBytes: 5 * MB,
  allowedTypes: PDF_TYPES,
};

/**
 * Multer options enforcing the size limit WHILE streaming the upload, so an
 * oversized file is rejected (413) before it is fully buffered in RAM.
 */
export function multerOptionsFor(rule: UploadRule): MulterOptions {
  return {
    limits: { fileSize: rule.maxBytes, files: 1, fields: 0 },
  };
}

/**
 * Checks presence, size and REAL type (magic bytes) of an uploaded file.
 * Returns the detected MIME type — never trust `file.mimetype` from the client.
 */
export function validateUploadedFile(
  file: Express.Multer.File | undefined,
  rule: UploadRule,
): DetectedFileType {
  if (!file || !file.buffer) {
    throw new BadRequestException(
      `${rule.label} file is required (multipart field "file").`,
    );
  }

  if (file.size > rule.maxBytes) {
    throw new PayloadTooLargeException(
      `${rule.label} too large. Maximum size is ${rule.maxBytes / MB}MB.`,
    );
  }

  const detected = detectFileType(file.buffer);
  if (!detected || !rule.allowedTypes.includes(detected)) {
    throw new BadRequestException(
      `Invalid ${rule.label.toLowerCase()} file type. Allowed: ${rule.allowedTypes.join(', ')}.`,
    );
  }

  return detected;
}
