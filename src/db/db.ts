import { getDb } from './index';

const databaseUrl = import.meta.env.TURSO_DATABASE_URL;
const authToken = import.meta.env.TURSO_AUTH_TOKEN || '';

if (!databaseUrl) {
  throw new Error('TURSO_DATABASE_URL is not defined in environment variables');
}

export const db = getDb(databaseUrl, authToken);
