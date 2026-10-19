import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

// Global: a single S3 client shared by users, companies and applications
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
