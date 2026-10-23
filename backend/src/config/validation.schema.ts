import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // MongoDB
  MONGODB_URI: Joi.string().required(),

  // PostgreSQL (read by PrismaService and prisma.config.ts)
  DATABASE_URL: Joi.string().required(),

  // JWT — the two secrets must be different: a leaked access secret must not
  // allow forging refresh tokens (and vice versa)
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .required()
    .invalid(Joi.ref('JWT_ACCESS_SECRET'))
    .messages({
      'any.invalid':
        'JWT_REFRESH_SECRET must be different from JWT_ACCESS_SECRET',
    }),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  // Cookies — forced to secure in production, opt-in elsewhere
  COOKIE_SECURE: Joi.boolean().default(false),

  // HTTP — Express "trust proxy" (hop count, "loopback", subnet, true/false)
  TRUST_PROXY: Joi.string().default('1'),

  // Rate limiting (global default, per client IP)
  THROTTLE_TTL: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),

  // Swagger UI (defaults to disabled in production)
  SWAGGER_ENABLED: Joi.boolean(),

  // AWS S3
  AWS_REGION: Joi.string().required(),
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_BUCKET_NAME: Joi.string().required(),

  // Email
  EMAIL_HOST: Joi.string().required(),
  EMAIL_PORT: Joi.number().default(587),
  EMAIL_USER: Joi.string().required(),
  EMAIL_PASS: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),

  // Client
  CLIENT_URL: Joi.string().default('http://localhost:5173'),
});
