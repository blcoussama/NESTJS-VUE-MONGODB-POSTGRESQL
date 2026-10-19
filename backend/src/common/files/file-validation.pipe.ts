import { Injectable, PipeTransform } from '@nestjs/common';
import { UploadRule, validateUploadedFile } from './upload-rules';

/**
 * Rejects missing files, oversized files and files whose content does not
 * match an allowed type. Normalises `file.mimetype` to the detected type.
 *
 * Usage: `@UploadedFile(new FileValidationPipe(AVATAR_UPLOAD)) file`
 */
@Injectable()
export class FileValidationPipe implements PipeTransform<
  Express.Multer.File | undefined,
  Express.Multer.File
> {
  constructor(private readonly rule: UploadRule) {}

  transform(file: Express.Multer.File | undefined): Express.Multer.File {
    const detected = validateUploadedFile(file, this.rule);
    const validFile = file as Express.Multer.File;
    validFile.mimetype = detected;
    return validFile;
  }
}
