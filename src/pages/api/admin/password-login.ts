import { handleAdminPasswordLogin } from '../../../lib/admin-password-login';

export const prerender = false;

export async function POST({ request }: { request: Request }) {
  return handleAdminPasswordLogin(request);
}
