import configuration, { parseTrustProxy } from './configuration';
import { validationSchema } from './validation.schema';

const VALID_ENV = {
  MONGODB_URI: 'mongodb://127.0.0.1:27018/test',
  DATABASE_URL: 'postgresql://user@127.0.0.1:5432/test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  AWS_REGION: 'eu-west-3',
  AWS_ACCESS_KEY_ID: 'x',
  AWS_SECRET_ACCESS_KEY: 'y',
  AWS_BUCKET_NAME: 'z',
  EMAIL_HOST: 'localhost',
  EMAIL_USER: 'u',
  EMAIL_PASS: 'p',
  EMAIL_FROM: 'no-reply@example.com',
};

describe('validationSchema', () => {
  it('accepts a complete environment', () => {
    expect(validationSchema.validate(VALID_ENV).error).toBeUndefined();
  });

  it('refuses identical access and refresh secrets', () => {
    const { error } = validationSchema.validate({
      ...VALID_ENV,
      JWT_REFRESH_SECRET: VALID_ENV.JWT_ACCESS_SECRET,
    });
    expect(error?.message).toMatch(/must be different/);
  });

  it('refuses secrets shorter than 32 characters', () => {
    const { error } = validationSchema.validate({
      ...VALID_ENV,
      JWT_ACCESS_SECRET: 'short',
    });
    expect(error).toBeDefined();
  });

  it('requires DATABASE_URL', () => {
    const env: Record<string, string> = { ...VALID_ENV };
    delete env.DATABASE_URL;
    expect(validationSchema.validate(env).error).toBeDefined();
  });
});

describe('configuration', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it.each([
    [undefined, 1],
    ['false', false],
    ['true', true],
    ['2', 2],
    ['loopback', 'loopback'],
  ])('parseTrustProxy(%p) → %p', (raw, expected) => {
    expect(parseTrustProxy(raw)).toBe(expected);
  });

  it('forces secure cookies and disables Swagger by default in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'false';
    delete process.env.SWAGGER_ENABLED;

    const config = configuration();

    expect(config.cookies.secure).toBe(true);
    expect(config.swagger.enabled).toBe(false);
  });

  it('keeps cookies non-secure and Swagger on by default in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.COOKIE_SECURE;
    delete process.env.SWAGGER_ENABLED;

    const config = configuration();

    expect(config.cookies.secure).toBe(false);
    expect(config.swagger.enabled).toBe(true);
  });
});
