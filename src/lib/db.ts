import type { SupabaseClient } from '@supabase/supabase-js';

const _schemaCache: Map<string, boolean> = new Map();
const _tableCache: Map<string, boolean> = new Map();

export async function tableExists(sb: SupabaseClient, tableName: string): Promise<boolean> {
  if (_tableCache.has(tableName)) return _tableCache.get(tableName)!;
  const { error } = await sb.from(tableName).select('*').limit(1);
  const result = error == null;
  _tableCache.set(tableName, result);
  return result;
}

export async function columnExists(
  sb: SupabaseClient,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const key = `${tableName}.${columnName}`;
  if (_schemaCache.has(key)) return _schemaCache.get(key)!;
  const { error } = await sb.from(tableName).select(columnName).limit(1);
  const result = error == null;
  _schemaCache.set(key, result);
  return result;
}

export function applyBoolFilter(
  query: any,
  columnName: string,
  filterValue: string
) {
  if (filterValue === 'True') return query.is(columnName, true);
  if (filterValue === 'False') return query.is(columnName, false);
  return query;
}

export async function fetchAllRows(
  sb: SupabaseClient,
  buildQuery: () => any,
  pageSize = 1000
): Promise<any[]> {
  const rows: any[] = [];
  let start = 0;
  while (true) {
    const { data, error } = await buildQuery().range(start, start + pageSize - 1);
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    start += pageSize;
  }
  return rows;
}

export async function fetchQuestionTypes(sb: SupabaseClient): Promise<string[]> {
  const { data, error } = await sb.from('vqa').select('qtype').limit(5000);
  if (error || !data) return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const row of data) {
    const v = (row.qtype || '').trim();
    if (v && !seen.has(v)) { seen.add(v); values.push(v); }
  }
  return values.sort();
}
