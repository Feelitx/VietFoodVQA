import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.js';
import { columnExists } from '../../../lib/db.js';
import { nowIso } from '../../../lib/utils.js';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = params.id as string;
  const { data, error } = await supabase.from('image').select('*').eq('image_id', id).limit(1);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  const row = data?.[0];
  if (!row) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify(row), { headers: { 'Content-Type': 'application/json' } });
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id as string;
  const body = await request.json();
  const payload: Record<string, unknown> = {
    food_items: body.food_items,
    image_desc: body.image_desc || null,
    is_drop: body.is_drop,
    is_checked: true,
  };
  if (await columnExists(supabase, 'image', 'updated_at')) {
    payload.updated_at = nowIso();
  }
  const { error } = await supabase.from('image').update(payload).eq('image_id', id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
