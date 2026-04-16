import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.js';

export const prerender = false;

export const GET: APIRoute = async () => {
  const { count: total, error: err1 } = await supabase
    .from('kg_triple_catalog')
    .select('*', { count: 'exact', head: true });
    
  const { count: verified, error: err2 } = await supabase
    .from('kg_triple_catalog')
    .select('*', { count: 'exact', head: true })
    .eq('is_checked', true);

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
