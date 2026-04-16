import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.js';
import { applyBoolFilter } from '../../../lib/db.js';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const startId = url.searchParams.get('start') ?? 'image000000';
  const endId = url.searchParams.get('end') ?? 'image001000';
  const isDrop = url.searchParams.get('is_drop') ?? 'Tất cả';
  const isChecked = url.searchParams.get('is_checked') ?? 'Tất cả';

  let query = supabase
    .from('image')
    .select('image_id')
    .gte('image_id', startId)
    .lte('image_id', endId)
    .order('image_id');

  query = applyBoolFilter(query, 'is_drop', isDrop);
  query = applyBoolFilter(query, 'is_checked', isChecked);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify(data ?? []), { headers: { 'Content-Type': 'application/json' } });
};
