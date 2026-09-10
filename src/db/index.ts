import { drizzle } from 'drizzle-orm/libsql';
import { createClient as createWebClient } from '@libsql/client/web';
import { createRequire } from 'node:module';
import path from 'node:path';

type LibSqlClientConfig = Parameters<typeof createWebClient>[0];

const require = createRequire(path.join(process.cwd(), 'package.json'));
const localClientModuleName = ['@libsql', 'client/node'].join('/');

function isLocalDatabaseUrl(url: string) {
  return url === ':memory:' || url.startsWith('file:') || url.startsWith('sqlite:');
}

export function normalizeDatabaseUrl(url: string) {
  const trimmedUrl = url.trim();
  if (!trimmedUrl || isLocalDatabaseUrl(trimmedUrl) || /^[a-z][a-z0-9+.-]*:/i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  return `libsql://${trimmedUrl}`;
}

function createLocalClient(config: LibSqlClientConfig) {
  const { createClient } = require(localClientModuleName) as { createClient: typeof createWebClient };
  return createClient(config);
}

export function getDb(url: string, authToken?: string) {
  const normalizedUrl = normalizeDatabaseUrl(url);
  const config = { 
    url: normalizedUrl,
    authToken: authToken || undefined 
  };
  const client = isLocalDatabaseUrl(normalizedUrl) ? createLocalClient(config) : createWebClient(config);

  return drizzle(client);
}
