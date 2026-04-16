import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.js';
import { applyBoolFilter, columnExists, fetchAllRows } from '../../../lib/db.js';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const startId = parseInt(url.searchParams.get('start') ?? '1');
  const endId = parseInt(url.searchParams.get('end') ?? '1000');
  const isDrop = url.searchParams.get('is_drop') ?? 'Tất cả';
  const isChecked = url.searchParams.get('is_checked') ?? 'Tất cả';
  const qtype = url.searchParams.get('qtype') ?? 'Tất cả';
  const split = url.searchParams.get('split') ?? 'Tất cả';

  // ── Progress for the raw range (before user filters) ─────────────────────
  const hasSplit = await columnExists(supabase, 'vqa', 'split');
  let progressQuery = supabase
    .from('vqa')
    .select(hasSplit ? 'vqa_id,is_checked,split' : 'vqa_id,is_checked')
    .gte('vqa_id', startId)
    .lte('vqa_id', endId)
    .order('vqa_id');
  if (split !== 'Tất cả' && hasSplit) progressQuery = progressQuery.eq('split', split);
  const { data: progressData, error: progressErr } = await progressQuery;
  if (progressErr) return new Response(JSON.stringify({ error: progressErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  const totalAssigned = (progressData ?? []).length;
  const verifiedCount = (progressData ?? []).filter((r: any) => r.is_checked === true).length;

  // ── Filtered VQA list ────────────────────────────────────────────────────
  let selectCols = 'vqa_id,image_id,qtype,question,is_checked,is_drop';
  if (hasSplit) selectCols += ',split';
  if (await columnExists(supabase, 'vqa', 'triples_used')) selectCols += ',triples_used';
  if (await columnExists(supabase, 'vqa', 'triples_retrieved')) selectCols += ',triples_retrieved';

  let vqaQuery: any = supabase
    .from('vqa')
    .select(selectCols)
    .gte('vqa_id', startId)
    .lte('vqa_id', endId)
    .order('vqa_id');
  vqaQuery = applyBoolFilter(vqaQuery, 'is_drop', isDrop);
  vqaQuery = applyBoolFilter(vqaQuery, 'is_checked', isChecked);
  if (qtype !== 'Tất cả') vqaQuery = vqaQuery.eq('qtype', qtype);
  if (split !== 'Tất cả' && hasSplit) vqaQuery = vqaQuery.eq('split', split);

  const { data: vqaRows, error: vqaErr } = await vqaQuery;
  if (vqaErr) return new Response(JSON.stringify({ error: vqaErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const rows = vqaRows ?? [];
  const imageIds = [...new Set(rows.map((r: any) => r.image_id).filter(Boolean))] as string[];

  let imageMap: Record<string, any> = {};
  if (imageIds.length > 0) {
    const { data: imgData } = await supabase
      .from('image')
      .select('image_id,image_url,food_items,image_desc,is_checked,is_drop')
      .in('image_id', imageIds);
    for (const img of imgData ?? []) imageMap[img.image_id] = img;
  }

  const filteredRows = rows;

  return new Response(JSON.stringify({
    vqa_rows: filteredRows,
    image_map: imageMap,
    progress: { total_assigned: totalAssigned, verified_count: verifiedCount, unverified_count: totalAssigned - verifiedCount },
  }), { headers: { 'Content-Type': 'application/json' } });
};
