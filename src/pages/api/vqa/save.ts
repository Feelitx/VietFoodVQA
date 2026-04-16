import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.js';
import { columnExists, tableExists } from '../../../lib/db.js';
import {
  normText, safeInt, nowIso,
  canonicalizeTriple, tripleKey,
  parseChoicesBlock, evaluateVerify, buildVerifyPayload,
  type Triple, type VerifyScores,
} from '../../../lib/utils.js';

export const prerender = false;

// ── Catalog helpers ──────────────────────────────────────────────────────────

async function findCatalogTriple(subject: string, relation: string, target: string): Promise<any | null> {
  if (!await tableExists(supabase, 'kg_triple_catalog')) return null;
  const { data } = await supabase
    .from('kg_triple_catalog')
    .select('*')
    .eq('subject', subject)
    .eq('relation', relation)
    .eq('target', target)
    .limit(1);
  return data?.[0] ?? null;
}

async function ensureCatalogTriple(triple: Triple, parentTripleId?: number | null): Promise<number | null> {
  const existing = await findCatalogTriple(triple.subject, triple.relation, triple.target);
  if (existing) return safeInt(existing.triple_id, 0) || null;

  const payload: Record<string, unknown> = {
    subject: triple.subject,
    relation: triple.relation,
    target: triple.target,
    evidence: triple.evidence ?? null,
    source_url: triple.source_url ?? null,
  };
  if (await columnExists(supabase, 'kg_triple_catalog', 'is_checked')) payload.is_checked = false;
  if (await columnExists(supabase, 'kg_triple_catalog', 'is_drop')) payload.is_drop = false;
  if (await columnExists(supabase, 'kg_triple_catalog', 'created_from'))
    payload.created_from = parentTripleId ? 'vqa_edit' : 'vqa_inline_review';
  if (await columnExists(supabase, 'kg_triple_catalog', 'parent_triple_id') && parentTripleId != null)
    payload.parent_triple_id = parentTripleId;
  if (await columnExists(supabase, 'kg_triple_catalog', 'needs_review')) payload.needs_review = true;
  if (await columnExists(supabase, 'kg_triple_catalog', 'updated_at')) payload.updated_at = nowIso();

  await supabase.from('kg_triple_catalog').upsert(payload, { onConflict: 'subject,relation,target' });
  const created = await findCatalogTriple(triple.subject, triple.relation, triple.target);
  return created ? safeInt(created.triple_id, 0) || null : null;
}

async function maybeUpdateCatalogReview(tripleId: number | null, verdict: string): Promise<void> {
  if (!tripleId) return;
  if (verdict !== 'valid' && verdict !== 'invalid') return;
  if (!await columnExists(supabase, 'kg_triple_catalog', 'is_checked')) return;
  if (!await columnExists(supabase, 'kg_triple_catalog', 'is_drop')) return;
  const payload: Record<string, unknown> = { is_checked: true, is_drop: verdict === 'invalid' };
  if (await columnExists(supabase, 'kg_triple_catalog', 'updated_at')) payload.updated_at = nowIso();
  await supabase.from('kg_triple_catalog').update(payload).eq('triple_id', tripleId);
}

// ── Map helpers ──────────────────────────────────────────────────────────────

async function upsertVqaTripleMap(raw: Record<string, unknown>): Promise<void> {
  if (!await tableExists(supabase, 'vqa_kg_triple_map')) return;
  const payload = { ...raw };
  if (await columnExists(supabase, 'vqa_kg_triple_map', 'updated_at')) payload.updated_at = nowIso();

  const optionalCols = [
    'is_active_for_vqa', 'triple_review_status', 'triple_review_note',
    'replaced_by_triple_id', 'reviewed_from_page', 'reviewed_at', 'is_used',
  ];
  for (const col of optionalCols) {
    if (!(await columnExists(supabase, 'vqa_kg_triple_map', col))) delete payload[col];
  }
  await supabase.from('vqa_kg_triple_map').upsert(payload, { onConflict: 'vqa_id,triple_id' });
}

async function insertTripleEditLog(
  vqaId: number, oldTripleId: number, newTripleId: number,
  editReason?: string, editorNote?: string
): Promise<void> {
  if (!await tableExists(supabase, 'kg_triple_edit_log')) return;
  const payload: Record<string, unknown> = { vqa_id: vqaId, old_triple_id: oldTripleId, new_triple_id: newTripleId };
  if (await columnExists(supabase, 'kg_triple_edit_log', 'edit_reason')) payload.edit_reason = editReason ?? null;
  if (await columnExists(supabase, 'kg_triple_edit_log', 'editor_note')) payload.editor_note = editorNote ?? null;
  await supabase.from('kg_triple_edit_log').insert(payload);
}

async function syncVqaTriplesUsed(vqaId: number, activeTriples: Triple[]): Promise<void> {
  if (!await columnExists(supabase, 'vqa', 'triples_used')) return;
  const payload: Record<string, unknown> = { triples_used: activeTriples };
  if (await columnExists(supabase, 'vqa', 'updated_at')) payload.updated_at = nowIso();
  await supabase.from('vqa').update(payload).eq('vqa_id', vqaId);
}

// ── Main handler ─────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const {
    vqa_id,
    qtype, question, choice_a, choice_b, choice_c, choice_d, answer, rationale,
    scores, decision, notes, rule_text,
    triple_drafts,
    vqa_row,  // full original row for find_existing_column logic
  } = body;

  // Build primary VQA payload
  const vqaPayload: Record<string, unknown> = {
    qtype: normText(qtype),
    question: normText(question),
    choice_a: normText(choice_a),
    choice_b: normText(choice_b),
    choice_c: normText(choice_c),
    choice_d: normText(choice_d),
    answer,
    rationale: normText(rationale) || null,
    is_drop: decision === 'DROP',
    is_checked: true,
  };
  if (await columnExists(supabase, 'vqa', 'updated_at')) vqaPayload.updated_at = nowIso();

  // Merge verify scores/decision into mapped columns
  Object.assign(vqaPayload, buildVerifyPayload(vqa_row, scores as VerifyScores, decision, notes, rule_text));

  const { error: vqaErr } = await supabase.from('vqa').update(vqaPayload).eq('vqa_id', vqa_id);
  if (vqaErr) return new Response(JSON.stringify({ error: vqaErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  // ── Process triple drafts ─────────────────────────────────────────────────
  const activeTriples: Triple[] = [];
  const mappingEnabled = await tableExists(supabase, 'vqa_kg_triple_map');
  const editLogEnabled = await tableExists(supabase, 'kg_triple_edit_log');
  const ts = nowIso();

  for (const draft of triple_drafts ?? []) {
    const oldTriple: Triple = draft.old_triple;
    const action: string = draft.action;
    const note: string | null = draft.editor_note?.trim() || null;
    let oldTripleId: number | null = draft.old_triple_id ?? await ensureCatalogTriple(oldTriple);

    if (action === 'valid') {
      activeTriples.push(oldTriple);
      await maybeUpdateCatalogReview(oldTripleId, 'valid');
      if (mappingEnabled && oldTripleId) {
        await upsertVqaTripleMap({
          vqa_id, triple_id: oldTripleId, is_used: true, is_active_for_vqa: true,
          triple_review_status: 'valid', triple_review_note: note,
          reviewed_from_page: 'vqa_page', reviewed_at: ts,
        });
      }

    } else if (action === 'invalid') {
      await maybeUpdateCatalogReview(oldTripleId, 'invalid');
      if (mappingEnabled && oldTripleId) {
        await upsertVqaTripleMap({
          vqa_id, triple_id: oldTripleId, is_used: true, is_active_for_vqa: false,
          triple_review_status: 'invalid', triple_review_note: note,
          reviewed_from_page: 'vqa_page', reviewed_at: ts,
        });
      }

    } else if (action === 'needs_edit') {
      const editedRaw: Record<string, unknown> = draft.edited_triple;
      const edited = canonicalizeTriple(editedRaw) ?? {
        subject: normText(editedRaw.subject), relation: normText(editedRaw.relation),
        target: normText(editedRaw.target), evidence: normText(editedRaw.evidence) || null,
        source_url: normText(editedRaw.source_url) || null,
      };
      const newTripleId = await ensureCatalogTriple(edited as Triple, oldTripleId);
      activeTriples.push(edited as Triple);
      if (mappingEnabled && oldTripleId) {
        await upsertVqaTripleMap({
          vqa_id, triple_id: oldTripleId, is_used: true, is_active_for_vqa: false,
          triple_review_status: 'needs_edit', triple_review_note: note,
          replaced_by_triple_id: newTripleId, reviewed_from_page: 'vqa_page', reviewed_at: ts,
        });
      }
      if (mappingEnabled && newTripleId) {
        await upsertVqaTripleMap({
          vqa_id, triple_id: newTripleId, is_used: true, is_active_for_vqa: true,
          triple_review_status: 'valid', triple_review_note: draft.edit_reason?.trim() || note,
          reviewed_from_page: 'vqa_page', reviewed_at: ts,
        });
      }
      if (editLogEnabled && oldTripleId && newTripleId) {
        await insertTripleEditLog(vqa_id, oldTripleId, newTripleId, draft.edit_reason, note ?? undefined);
      }

    } else { // unsure
      activeTriples.push(oldTriple);
      if (mappingEnabled && oldTripleId) {
        await upsertVqaTripleMap({
          vqa_id, triple_id: oldTripleId, is_used: true, is_active_for_vqa: true,
          triple_review_status: 'unsure', triple_review_note: note,
          reviewed_from_page: 'vqa_page', reviewed_at: ts,
        });
      }
    }
  }

  await syncVqaTriplesUsed(vqa_id, activeTriples);

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
