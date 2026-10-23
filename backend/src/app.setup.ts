import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

export const API_PREFIX = 'api';

/**
 * HTTP configuration shared by main.ts and the e2e tests, so that the tests
 * exercise exactly the production pipeline (prefix, validation, CORS…).
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);

  // Behind a reverse proxy (nginx): req.ip = real client IP (rate limiting).
  // Must match the real topology, otherwise X-Forwarded-For can be spoofed.
  const trustProxy = config.get<boolean | number | string>('http.trustProxy');
  if (trustProxy !== undefined && trustProxy !== false) {
    app.set('trust proxy', trustProxy);
  }

  // Security headers (CSP, HSTS, X-Frame-Options, etc.)
  app.use(helmet());

  // Parse httpOnly cookies (used by JWT refresh token)
  app.use(cookieParser());

  // All routes prefixed with /api
  app.setGlobalPrefix(API_PREFIX);

  // CORS — allow only frontend origin, with credentials (cookies)
  app.enableCors({
    origin: config.get<string>('client.url'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe — rejects unknown fields, no implicit type
  // coercion ("false" must not silently become true): query DTOs convert
  // explicitly with @Type(() => Number)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
    }),
  );
}

/** Swagger (OpenAPI) UI at /api/docs — disabled by default in production. */
export function setupSwagger(app: NestExpressApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('PROFYLE API')
    .setDescription(
      'Job recruitment platform REST API — v2 NestJS. ' +
        'Errors: { statusCode, message, error }. ' +
        'Auth: Bearer access token (15 min) + httpOnly refresh cookie (path /api/auth).',
    )
    .setVersion('2.0.0')
    .addBearerAuth()
    .addCookieAuth('RefreshToken')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, document);
}
