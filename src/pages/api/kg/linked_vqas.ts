import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.js';
import { tableExists } from '../../../lib/db.js';
import { safeInt, normText } from '../../../lib/utils.js';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const tripleId = parseInt(url.searchParams.get('triple_id') ?? '0');

  if (!await tableExists(supabase, 'vqa_kg_triple_map')) {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  }

  const { data: mappingRows, error } = await supabase
    .from('vqa_kg_triple_map')
    .select('vqa_id,triple_id,triple_review_status,is_used,is_retrieved,is_active_for_vqa,replaced_by_triple_id')
    .eq('triple_id', tripleId);

  if (error) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  if (!mappingRows?.length) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });

  const vqaIds = mappingRows.map((r: any) => r.vqa_id).filter(Boolean);
  let vqaLookup: Record<number, any> = {};
  if (vqaIds.length > 0) {
    const { data: vqaData } = await supabase
      .from('vqa')
      .select('vqa_id,image_id,qtype,question,is_checked,is_drop,split')
      .in('vqa_id', vqaIds);
    for (const row of vqaData ?? []) vqaLookup[safeInt(row.vqa_id, 0)] = row;
  }

  const linked = mappingRows.map((row: any) => ({
    ...vqaLookup[safeInt(row.vqa_id, 0)] ?? {},
    ...row,
  }));

  return new Response(JSON.stringify(linked), { headers: { 'Content-Type': 'application/json' } });
};
