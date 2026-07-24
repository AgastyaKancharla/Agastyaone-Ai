import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config/env';

export function getSupabaseClient() {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY);
}
