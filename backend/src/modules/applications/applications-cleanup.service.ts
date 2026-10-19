import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApplicationsService } from './applications.service';

/** Daily job: deletes withdrawn applications whose `expiresAt` has passed. */
@Injectable()
export class ApplicationsCleanupService {
  private readonly logger = new Logger(ApplicationsCleanupService.name);

  constructor(private readonly applicationsService: ApplicationsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: 'purge-expired-applications',
  })
  async handleCron(): Promise<void> {
    try {
      const count = await this.applicationsService.purgeExpired(new Date());
      if (count > 0) {
        this.logger.log(`Purged ${count} expired withdrawn application(s)`);
      }
    } catch {
      this.logger.error('Failed to purge expired applications');
    }
  }
}
