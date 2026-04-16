import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.js';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = params.id as string;
  const { data, error } = await supabase.from('vqa').select('*').eq('vqa_id', parseInt(id)).limit(1);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  const row = data?.[0];
  if (!row) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify(row), { headers: { 'Content-Type': 'application/json' } });
};
