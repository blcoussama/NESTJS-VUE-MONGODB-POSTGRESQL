import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { Readable } from 'stream';
import { detectFileType } from './file-signature';
import {
  AVATAR_UPLOAD,
  CV_UPLOAD,
  multerOptionsFor,
  validateUploadedFile,
} from './upload-rules';
import { FileValidationPipe } from './file-validation.pipe';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8L', 'latin1');
const PDF = Buffer.from('%PDF-1.4\n', 'latin1');

function file(buffer: Buffer, mimetype = 'image/png', size = buffer.length) {
  return {
    fieldname: 'file',
    originalname: 'x',
    encoding: '7bit',
    mimetype,
    size,
    buffer,
    stream: new Readable(),
    destination: '',
    filename: '',
    path: '',
  } as Express.Multer.File;
}

describe('detectFileType (magic bytes)', () => {
  it.each([
    [JPEG, 'image/jpeg'],
    [PNG, 'image/png'],
    [WEBP, 'image/webp'],
    [PDF, 'application/pdf'],
    [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'), null],
    [Buffer.from('GIF89a'), null],
    [Buffer.from('RIFF\x10\x00\x00\x00WAVEfmt ', 'latin1'), null],
    [Buffer.alloc(2), null],
  ])('%#: detects %s', (buffer, expected) => {
    expect(detectFileType(buffer)).toBe(expected);
  });

  it('returns null for an undefined buffer', () => {
    expect(detectFileType(undefined)).toBeNull();
  });
});

describe('validateUploadedFile', () => {
  it('requires a file', () => {
    expect(() => validateUploadedFile(undefined, AVATAR_UPLOAD)).toThrow(
      BadRequestException,
    );
  });

  it('enforces the size limit with 413', () => {
    expect(() =>
      validateUploadedFile(
        file(PNG, 'image/png', 2 * 1024 * 1024 + 1),
        AVATAR_UPLOAD,
      ),
    ).toThrow(PayloadTooLargeException);
  });

  it('ignores the declared MIME type and checks the content', () => {
    expect(() =>
      validateUploadedFile(file(PDF, 'image/png'), AVATAR_UPLOAD),
    ).toThrow(BadRequestException);
    expect(validateUploadedFile(file(PDF, 'image/png'), CV_UPLOAD)).toBe(
      'application/pdf',
    );
  });

  it('accepts a 5MB CV but not a 5MB avatar', () => {
    const fiveMb = 5 * 1024 * 1024;
    expect(
      validateUploadedFile(file(PDF, 'application/pdf', fiveMb), CV_UPLOAD),
    ).toBe('application/pdf');
    expect(() =>
      validateUploadedFile(file(PNG, 'image/png', fiveMb), AVATAR_UPLOAD),
    ).toThrow(PayloadTooLargeException);
  });
});

describe('multerOptionsFor', () => {
  it('makes multer stop reading beyond the limit (before buffering in RAM)', () => {
    expect(multerOptionsFor(CV_UPLOAD)).toEqual({
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
    });
  });
});

describe('FileValidationPipe', () => {
  it('normalises mimetype to the detected type', () => {
    const pipe = new FileValidationPipe(AVATAR_UPLOAD);
    const result = pipe.transform(file(JPEG, 'image/png'));

    expect(result.mimetype).toBe('image/jpeg');
  });

  it('rejects a missing file with 400 (instead of a 500)', () => {
    const pipe = new FileValidationPipe(CV_UPLOAD);

    expect(() => pipe.transform(undefined)).toThrow(BadRequestException);
  });
});
