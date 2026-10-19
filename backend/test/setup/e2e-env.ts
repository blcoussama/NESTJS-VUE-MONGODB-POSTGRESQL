import { randomBytes } from 'crypto';
import { assertDisposableTestDatabases } from './test-databases';

// Runs before each e2e file. Only the two database URLs come from the
// environment; everything else gets throw-away values, and the developer's
// .env file is never read (ConfigModule ignores it when NODE_ENV=test).
assertDisposableTestDatabases();

const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
  AWS_REGION: 'eu-west-3',
  AWS_ACCESS_KEY_ID: 'AKIAFAKEE2ETESTKEY00',
  AWS_SECRET_ACCESS_KEY: 'fake-e2e-secret-access-key',
  AWS_BUCKET_NAME: 'profyle-e2e-fake-bucket',
  // No email is ever sent: EmailService is replaced by a fake in the tests
  EMAIL_HOST: '127.0.0.1',
  EMAIL_PORT: '9',
  EMAIL_USER: 'e2e',
  EMAIL_PASS: 'e2e',
  EMAIL_FROM: 'no-reply@example.com',
  CLIENT_URL: 'http://localhost:5173',
  // Supertest connects from loopback: X-Forwarded-For simulates distinct
  // clients, exactly like requests coming through the nginx reverse proxy
  TRUST_PROXY: 'loopback',
};

process.env.NODE_ENV = 'test';
for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) process.env[key] = value;
}
