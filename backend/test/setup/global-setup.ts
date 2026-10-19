import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import mongoose from 'mongoose';
import * as os from 'os';
import { Client } from 'pg';
import { assertDisposableTestDatabases } from './test-databases';
import { chatDatabaseUrls } from './chat-databases';

const BACKEND_DIR = join(__dirname, '..', '..');

function migrate(databaseUrl: string): void {
  execSync('npx prisma migrate deploy', {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

/** Once per run: apply migrations, then empty both test databases. */
export default async function globalSetup(): Promise<void> {
  const { mongoUri, databaseUrl } = assertDisposableTestDatabases();

  migrate(databaseUrl);

  // The chat suite (test/chat.e2e-spec.ts) uses its own throw-away databases
  // and expects the PostgreSQL schema to exist: keep its schema up to date.
  if (existsSync(join(__dirname, '..', 'chat.e2e-spec.ts'))) {
    const chatDatabaseUrl = chatDatabaseUrls().databaseUrl;
    if (chatDatabaseUrl !== databaseUrl) {
      try {
        migrate(chatDatabaseUrl);
      } catch {
        console.warn('e2e: could not migrate the chat test database');
      }
    }
  }

  const pg = new Client({ connectionString: databaseUrl });
  await pg.connect();
  await pg.query(
    'TRUNCATE TABLE "saved_jobs", "applications", "jobs", "companies" CASCADE',
  );
  await pg.end();

  const connection = await mongoose
    .createConnection(mongoUri, { runtimeAdapters: { os } })
    .asPromise();
  const collections = await connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
  await connection.close();
}
