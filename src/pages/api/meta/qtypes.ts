import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.js';
import { fetchQuestionTypes } from '../../../lib/db.js';

export const prerender = false;

export const GET: APIRoute = async () => {
  const qtypes = await fetchQuestionTypes(supabase);
  return new Response(JSON.stringify(qtypes), {
    headers: { 'Content-Type': 'application/json' },
  });
};
