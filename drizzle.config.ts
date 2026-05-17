import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const isLocal = process.env.TURSO_DATABASE_URL?.startsWith('file:');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: isLocal ? 'sqlite' : 'turso',
  dbCredentials: isLocal ? {
    url: process.env.TURSO_DATABASE_URL!,
  } : {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
