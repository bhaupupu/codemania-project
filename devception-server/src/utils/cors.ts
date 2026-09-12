import { env } from '../config/env';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://codemania-project.vercel.app',
  'https://devception.xyz',
  'https://devception.vercel.app',
];

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const configuredOrigins = (env.CLIENT_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (configuredOrigins.includes(origin) || DEFAULT_ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Allow any Vercel deployment of codemania-project or devception (e.g. preview branches)
  if (/^https:\/\/(codemania-project|devception)[a-zA-Z0-9-]*\.vercel\.app$/.test(origin)) {
    return true;
  }

  return false;
}
