import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

export function getDb(url: string, authToken?: string) {
  const client = createClient({ 
    url, 
    authToken: authToken || undefined 
  });
  return drizzle(client);
}
