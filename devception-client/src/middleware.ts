import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-me',
});

export const config = {
  // Protect routes that strictly require existing auth; allow /play to handle inline guest signin
  matcher: ['/results/:path*', '/profile', '/game/:path*'],
};
