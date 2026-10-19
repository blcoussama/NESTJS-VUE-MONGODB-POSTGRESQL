/**
 * Parses the TRUST_PROXY env var into a value accepted by Express
 * `app.set('trust proxy', …)`: a boolean, a hop count, or a subnet/keyword
 * list such as "loopback" or "10.0.0.0/8".
 */
export function parseTrustProxy(
  raw: string | undefined,
): boolean | number | string {
  const value = (raw ?? '1').trim();
  if (value === '' || value === 'false') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  return value;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1';
}

export default () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv,

    mongodb: {
      uri: process.env.MONGODB_URI,
    },

    database: {
      url: process.env.DATABASE_URL,
    },

    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
      refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
    },

    cookies: {
      // Always secure in production; opt-in elsewhere (plain http on localhost)
      secure: isProduction || parseBoolean(process.env.COOKIE_SECURE, false),
    },

    http: {
      trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    },

    throttle: {
      ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    },

    swagger: {
      enabled: parseBoolean(process.env.SWAGGER_ENABLED, !isProduction),
    },

    aws: {
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      bucketName: process.env.AWS_BUCKET_NAME,
    },

    email: {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT ?? '587', 10),
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
      from: process.env.EMAIL_FROM,
    },

    client: {
      url: process.env.CLIENT_URL ?? 'http://localhost:5173',
    },
  };
};
