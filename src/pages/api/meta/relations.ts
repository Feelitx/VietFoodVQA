import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.js';
import { tableExists } from '../../../lib/db.js';
import { normText } from '../../../lib/utils.js';

export const prerender = false;

export const GET: APIRoute = async () => {
  if (!await tableExists(supabase, 'kg_triple_catalog')) {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  }
  const { data, error } = await supabase.from('kg_triple_catalog').select('relation').limit(5000);
  if (error) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  const relations = [...new Set((data || []).map((r: any) => normText(r.relation)).filter(Boolean))].sort();
  return new Response(JSON.stringify(relations), { headers: { 'Content-Type': 'application/json' } });
};
