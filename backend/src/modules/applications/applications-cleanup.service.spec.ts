import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsCleanupService } from './applications-cleanup.service';
import { ApplicationsService } from './applications.service';

describe('ApplicationsCleanupService', () => {
  let module: TestingModule;
  let cleanup: ApplicationsCleanupService;
  let applications: { purgeExpired: jest.Mock };

  beforeEach(async () => {
    applications = { purgeExpired: jest.fn().mockResolvedValue(2) };
    module = await Test.createTestingModule({
      providers: [
        ApplicationsCleanupService,
        { provide: ApplicationsService, useValue: applications },
      ],
    }).compile();
    cleanup = module.get(ApplicationsCleanupService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('purges expired applications with the current date', async () => {
    const before = Date.now();

    await cleanup.handleCron();

    const [now] = applications.purgeExpired.mock.calls[0] as [Date];
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('never throws from the cron callback (errors are logged)', async () => {
    applications.purgeExpired.mockRejectedValue(new Error('db down'));

    await expect(cleanup.handleCron()).resolves.toBeUndefined();
  });

  it('is registered as a daily cron job at 03:00', () => {
    // Metadata written by @Cron(); the ScheduleModule reads it at startup
    const options = Reflect.getMetadata(
      'SCHEDULE_CRON_OPTIONS',
      Reflect.get(ApplicationsCleanupService.prototype, 'handleCron') as object,
    ) as { cronTime: string; name: string } | undefined;
    expect(options?.cronTime).toBe('0 03 * * *');
    expect(options?.name).toBe('purge-expired-applications');
  });
});
