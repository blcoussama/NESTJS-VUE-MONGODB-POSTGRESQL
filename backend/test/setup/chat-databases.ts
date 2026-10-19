/**
 * Throw-away databases used by the chat e2e suite (test/chat.e2e-spec.ts).
 *
 * Priority: CHAT_E2E_MONGODB_URI / CHAT_E2E_DATABASE_URL if set, otherwise the
 * main e2e databases (MONGODB_URI / DATABASE_URL) with a "_chat" suffix on the
 * database name — e.g. profyle_test → profyle_test_chat. The PostgreSQL one is
 * created by `prisma migrate deploy` in global-setup if it does not exist.
 */
export function withChatSuffix(url: string): string {
  const parsed = new URL(url);
  const name = parsed.pathname.replace(/^\//, '');
  parsed.pathname = `/${name ? `${name}_chat` : 'profyle_test_chat'}`;
  return parsed.toString();
}

export function chatDatabaseUrls(): { mongoUri: string; databaseUrl: string } {
  const mongoUri =
    process.env.CHAT_E2E_MONGODB_URI ??
    (process.env.MONGODB_URI
      ? withChatSuffix(process.env.MONGODB_URI)
      : 'mongodb://127.0.0.1:27017/profyle_test_chat');
  const databaseUrl =
    process.env.CHAT_E2E_DATABASE_URL ??
    (process.env.DATABASE_URL
      ? withChatSuffix(process.env.DATABASE_URL)
      : 'postgresql://postgres@127.0.0.1:5432/profyle_test_chat');
  return { mongoUri, databaseUrl };
}
