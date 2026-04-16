import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.js';
import { columnExists } from '../../../lib/db.js';
import { nowIso, safeInt } from '../../../lib/utils.js';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = parseInt(params.id as string);
  const { data, error } = await supabase.from('kg_triple_catalog').select('*').eq('triple_id', id).limit(1);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify(data?.[0] ?? null), { headers: { 'Content-Type': 'application/json' } });
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = parseInt(params.id as string);
  const body = await request.json();
  const verdict: string = body.verdict; // 'valid' | 'invalid' | 'unsure'

  if (!await columnExists(supabase, 'kg_triple_catalog', 'is_checked')) {
    return new Response(JSON.stringify({ error: 'Schema missing is_checked / is_drop columns' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const payload: Record<string, unknown> = {
    is_checked: verdict === 'valid' || verdict === 'invalid',
    is_drop: verdict === 'invalid',
  };
  if (body.subject !== undefined) payload.subject = body.subject;
  if (body.relation !== undefined) payload.relation = body.relation;
  if (body.target !== undefined) payload.target = body.target;
  if (await columnExists(supabase, 'kg_triple_catalog', 'updated_at')) payload.updated_at = nowIso();

  const { error } = await supabase.from('kg_triple_catalog').update(payload).eq('triple_id', id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
