import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  configureApp(app);

  // Close DB connections / stop cron jobs cleanly on SIGTERM (docker stop)
  app.enableShutdownHooks();

  const swaggerEnabled = config.get<boolean>('swagger.enabled') === true;
  if (swaggerEnabled) {
    setupSwagger(app);
  }

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);

  logger.log(`Application running on http://localhost:${port}/api`);
  logger.log(`Health check at    http://localhost:${port}/api/health`);
  if (swaggerEnabled) {
    logger.log(`Swagger docs at    http://localhost:${port}/api/docs`);
  }
}

void bootstrap();
