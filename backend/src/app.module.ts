import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import * as os from 'os';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { PrismaModule } from './database/prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { HealthController } from './common/health/health.controller';
import { AppThrottlerGuard } from './common/throttle/app-throttler.guard';
import { throttlerOptionsFactory } from './common/throttle/throttler.config';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { MongoExceptionFilter } from './common/filters/mongo-exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { SavedJobsModule } from './modules/saved-jobs/saved-jobs.module';

@Module({
  imports: [
    // Global config — reads .env, validates all required vars at startup.
    // Tests (NODE_ENV=test) never read the developer's .env file.
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),

    // MongoDB connection via Mongoose
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongodb.uri'),
        // Same module the driver would load itself via `await import('os')`,
        // which fails inside Jest's VM sandbox (e2e tests)
        runtimeAdapters: { os },
      }),
    }),

    // Rate limiting — global per-IP limit + stricter per-route auth limits
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: throttlerOptionsFactory,
    }),

    // Cron jobs (daily purge of expired withdrawn applications)
    ScheduleModule.forRoot(),

    // PostgreSQL connection via Prisma (global — injectable in any module)
    PrismaModule,

    // S3 storage (global)
    StorageModule,

    // Feature modules
    AuthModule,
    UsersModule,
    CompaniesModule,
    JobsModule,
    ApplicationsModule,
    SavedJobsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_FILTER, useClass: MongoExceptionFilter },
  ],
})
export class AppModule {}
