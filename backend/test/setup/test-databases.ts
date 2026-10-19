/**
 * The e2e suite WIPES the databases it runs against. They must be given
 * explicitly (MONGODB_URI, DATABASE_URL) and be local, disposable databases.
 * Remote hosts (e.g. CI service containers) need E2E_ALLOW_REMOTE_DB=true.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function assertDisposableTestDatabases(): {
  mongoUri: string;
  databaseUrl: string;
} {
  const mongoUri = process.env.MONGODB_URI;
  const databaseUrl = process.env.DATABASE_URL;

  if (!mongoUri || !databaseUrl) {
    throw new Error(
      'e2e: set MONGODB_URI and DATABASE_URL to DISPOSABLE test databases ' +
        '(they are wiped), e.g. mongodb://127.0.0.1:27018/profyle_api and ' +
        'postgresql://audit@127.0.0.1:55432/profyle_api',
    );
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('e2e: refusing to run with NODE_ENV=production');
  }

  if (process.env.E2E_ALLOW_REMOTE_DB !== 'true') {
    for (const url of [mongoUri, databaseUrl]) {
      const host = new URL(url).hostname;
      if (!LOCAL_HOSTS.has(host)) {
        throw new Error(
          `e2e: refusing to wipe a non-local database (${host}). ` +
            'Set E2E_ALLOW_REMOTE_DB=true for CI service containers.',
        );
      }
    }
  }

  return { mongoUri, databaseUrl };
}
