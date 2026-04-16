import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.js';
import { tableExists } from '../../../lib/db.js';
import { normText } from '../../../lib/utils.js';
import fs from 'node:fs';
import path from 'node:path';

export const prerender = false;

export const GET: APIRoute = async () => {
  const relations = new Set<string>();

  const csvPath = path.join(process.cwd(), 'data', 'question_types.csv');
  try {
    if (fs.existsSync(csvPath)) {
      const content = fs.readFileSync(csvPath, 'utf-8');
      const regex = /-\[(.*?)\]->/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        if (match[1]) relations.add(match[1].trim());
      }
    }
  } catch (e) {}

  if (await tableExists(supabase, 'kg_triple_catalog')) {
    const { data } = await supabase.from('kg_triple_catalog').select('relation').limit(5000);
    (data || []).forEach((r: any) => {
      const v = normText(r.relation);
      if (v) relations.add(v);
    });
  }

  return new Response(JSON.stringify(Array.from(relations).sort()), { 
    headers: { 'Content-Type': 'application/json' } 
  });
};
