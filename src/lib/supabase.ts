import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL) as string;
const supabaseKey = (process.env.PUBLIC_SUPABASE_KEY || process.env.SUPABASE_KEY) as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
