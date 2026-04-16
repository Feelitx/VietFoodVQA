import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.js';
import { applyBoolFilter, columnExists, tableExists, fetchAllRows } from '../../../lib/db.js';
import { normText } from '../../../lib/utils.js';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!await tableExists(supabase, 'kg_triple_catalog')) {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  }

  const url = new URL(request.url);
  const isChecked = url.searchParams.get('is_checked') ?? 'Tất cả';
  const isDrop = url.searchParams.get('is_drop') ?? 'Tất cả';
  const relation = url.searchParams.get('relation') ?? 'Tất cả';
  const search = url.searchParams.get('search') ?? '';
  const startId = url.searchParams.get('start_id');
  const endId = url.searchParams.get('end_id');

  let selectCols = 'triple_id,subject,relation,target,evidence,source_url';
  if (await columnExists(supabase, 'kg_triple_catalog', 'is_checked')) selectCols += ',is_checked';
  if (await columnExists(supabase, 'kg_triple_catalog', 'is_drop')) selectCols += ',is_drop';
  if (await columnExists(supabase, 'kg_triple_catalog', 'updated_at')) selectCols += ',updated_at';

  let baseQuery: any = supabase.from('kg_triple_catalog').select(selectCols).order('triple_id');
  if (startId) baseQuery = baseQuery.gte('triple_id', startId);
  if (endId) baseQuery = baseQuery.lte('triple_id', endId);
  if (await columnExists(supabase, 'kg_triple_catalog', 'is_checked')) baseQuery = applyBoolFilter(baseQuery, 'is_checked', isChecked);
  if (await columnExists(supabase, 'kg_triple_catalog', 'is_drop')) baseQuery = applyBoolFilter(baseQuery, 'is_drop', isDrop);
  if (relation !== 'Tất cả') baseQuery = baseQuery.eq('relation', relation);

  let rows = await fetchAllRows(supabase, () => baseQuery);

  const q = normText(search).toLowerCase();
  if (q) {
    rows = rows.filter(r =>
      normText(r.subject).toLowerCase().includes(q) ||
      normText(r.target).toLowerCase().includes(q) ||
      normText(r.relation).toLowerCase().includes(q)
    );
  }

  return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
};
