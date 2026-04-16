import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.js';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const params = url.searchParams;

  let queryTotal = supabase.from('kg_triple_catalog').select('*', { count: 'exact', head: true });
  let queryVerified = supabase.from('kg_triple_catalog').select('*', { count: 'exact', head: true }).eq('is_checked', true);

  const applyFilters = (query: any) => {
    if (params.get('relation') && params.get('relation') !== 'Tất cả') {
      query = query.eq('relation', params.get('relation'));
    }
    if (params.get('search')) {
      query = query.or(`subject.ilike.%${params.get('search')}%,target.ilike.%${params.get('search')}%,relation.ilike.%${params.get('search')}%`);
    }
    if (params.get('start_id')) query = query.gte('triple_id', parseInt(params.get('start_id')!));
    if (params.get('end_id')) query = query.lte('triple_id', parseInt(params.get('end_id')!));
    return query;
  };

  const { count: total, error: err1 } = await applyFilters(queryTotal);
  const { count: verified, error: err2 } = await applyFilters(queryVerified);

  if (err1 || err2) {
    return new Response(JSON.stringify({ error: err1?.message || err2?.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  return new Response(JSON.stringify({
    verified_count: verified || 0,
    unverified_count: (total || 0) - (verified || 0)
  }), { 
    headers: { 'Content-Type': 'application/json' } 
  });
};
