import { defineConfig } from 'auth-astro';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from './src/db/db';
import * as schema from './src/db/schema';
import Resend from '@auth/core/providers/resend';
import Credentials from '@auth/core/providers/credentials';

export default defineConfig({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: [
    Resend({
      apiKey: import.meta.env.RESEND_API_KEY,
      from: 'TVVC <no-reply@mail.tualatinvalleyvb.com>',
    }),
  ],
  pages: {
    signIn: '/portal/login',
    verifyRequest: '/portal/login',
  },
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        role: (user as any).role,
        stripeCustomerId: (user as any).stripeCustomerId,
        emergencyPhone: (user as any).emergencyPhone,
      },
    }),
  },
});
