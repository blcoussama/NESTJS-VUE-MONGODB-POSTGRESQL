import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { UsersModule } from '../users/users.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationsCleanupService } from './applications-cleanup.service';

@Module({
  imports: [JobsModule, UsersModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationsCleanupService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
