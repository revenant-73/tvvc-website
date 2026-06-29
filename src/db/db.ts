import { getDb } from './index';

let databaseUrl = typeof import.meta.env !== 'undefined' ? import.meta.env.TURSO_DATABASE_URL : undefined;
let authToken = (typeof import.meta.env !== 'undefined' ? import.meta.env.TURSO_AUTH_TOKEN : undefined) || '';

if (!databaseUrl && typeof process !== 'undefined') {
  databaseUrl = process.env.TURSO_DATABASE_URL;
  authToken = process.env.TURSO_AUTH_TOKEN || '';
}

export const db = databaseUrl ? getDb(databaseUrl, authToken) : null;

if (!db) {
  console.warn('TURSO_DATABASE_URL is not defined. Database operations will fail.');
}
