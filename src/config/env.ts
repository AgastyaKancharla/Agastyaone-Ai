import dotenv from 'dotenv';

dotenv.config();

export const CONFIG = {
  // Self-Hosted Playwright WebSocket endpoint (optional, if running separate Playwright container)
  PLAYWRIGHT_WS_ENDPOINT: process.env.PLAYWRIGHT_WS_ENDPOINT || '',

  // Supabase Cloud DB Config
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Worker Settings
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),
  HEADLESS: process.env.HEADLESS !== 'false'
};
