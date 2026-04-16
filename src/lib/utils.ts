// ── Text helpers ─────────────────────────────────────────────────────────────

export function normText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function safeInt(value: unknown, defaultVal: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : defaultVal;
}

export function nowIso(): string {
  return new Date().toISOString();
}

// ── JSON helpers ─────────────────────────────────────────────────────────────

export function parseJsonish(value: unknown): unknown {
  if (value == null) return [];
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

// ── Triple helpers ────────────────────────────────────────────────────────────

export interface Triple {
  subject: string;
  relation: string;
  target: string;
  evidence?: string | null;
  source_url?: string | null;
}

export function canonicalizeTriple(item: Record<string, unknown>): Triple | null {
  if (typeof item !== 'object' || item == null) return null;
  const subject = normText(item.subject);
  const relation = normText(item.relation);
  const target = normText(item.target);
  if (!subject || !relation || !target) return null;
  return {
    subject,
    relation,
    target,
    evidence: normText(item.evidence) || null,
    source_url: normText(item.source_url) || null,
  };
}

export function tripleKey(subject: string, relation: string, target: string): string {
  return `${normText(subject)}|${normText(relation)}|${normText(target)}`;
}

export function parseTripleList(value: unknown): Triple[] {
  const data = parseJsonish(value);
  if (!Array.isArray(data)) return [];
  const result: Triple[] = [];
  for (const item of data) {
    const t = canonicalizeTriple(item as Record<string, unknown>);
    if (t) result.push(t);
  }
  return result;
}

// ── Choices helpers ──────────────────────────────────────────────────────────

export function formatChoicesBlock(row: Record<string, unknown>): string {
  return [
    `A. ${normText(row.choice_a)}`,
    `B. ${normText(row.choice_b)}`,
    `C. ${normText(row.choice_c)}`,
    `D. ${normText(row.choice_d)}`,
  ].join('\n');
}

export function parseChoicesBlock(rawText: string): { parsed: Record<string, string>; missing: string[] } {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const parsed: Record<string, string> = {};
  const fallback: string[] = [];
  for (const line of lines) {
    if (line.length >= 2 && 'ABCD'.includes(line[0].toUpperCase()) && '.):- '.includes(line[1])) {
      const key = line[0].toUpperCase();
      const value = line.slice(2).replace(/^[.):\ -]+/, '').trim();
      if (value) parsed[key] = value;
    } else {
      fallback.push(line);
    }
  }
  if (Object.keys(parsed).length === 0 && fallback.length === 4) {
    ['A', 'B', 'C', 'D'].forEach((k, i) => { parsed[k] = fallback[i]; });
  }
  const missing = ['A', 'B', 'C', 'D'].filter(k => !parsed[k]);
  return { parsed, missing };
}

// ── Verify helpers ───────────────────────────────────────────────────────────

import { VERIFY_FIELD_CANDIDATES } from './constants.js';

export function findExistingColumn(row: Record<string, unknown>, logicalName: string): string | null {
  for (const candidate of VERIFY_FIELD_CANDIDATES[logicalName] ?? []) {
    if (candidate in row) return candidate;
  }
  return null;
}

export function getExistingVerifyValue(row: Record<string, unknown>, logicalName: string, defaultVal: unknown = null): unknown {
  const col = findExistingColumn(row, logicalName);
  if (col == null) return defaultVal;
  const v = row[col];
  return v == null ? defaultVal : v;
}

export interface VerifyScores { q0: number; q1: number; q2: number }

export function evaluateVerify(scores: VerifyScores): { decision: string; rule: string; reasons: string[] } {
  const reasons: string[] = [];
  const firedRules: string[] = [];
  let decision = 'KEEP';

  if (scores.q0 <= 2) {
    decision = 'DROP';
    firedRules.push('Q0<=2');
    reasons.push('Q0 ≤ 2: triple_used sai, yếu hoặc chưa đủ tin cậy cho câu hỏi.');
  }
  if (scores.q1 <= 2) {
    decision = 'DROP';
    firedRules.push('Q1<=2');
    reasons.push('Q1 ≤ 2: question sai bản chất hoặc diễn đạt không đạt.');
  }
  if (scores.q2 <= 2) {
    reasons.push('Q2 ≤ 2: đáp án hoặc distractor có vấn đề, cần kiểm tra lại choices.');
  }
  if (decision === 'KEEP') {
    reasons.push('Không kích hoạt hard-drop rule nào từ rubric hiện tại.');
  }
  const rule = firedRules.length ? firedRules.join(' + ') : 'PASS';
  return { decision, rule, reasons };
}

export function buildVerifyPayload(
  row: Record<string, unknown>,
  scores: VerifyScores,
  decision: string,
  notes: string,
  ruleText: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const mapping: Record<string, unknown> = {
    q0: scores.q0, q1: scores.q1, q2: scores.q2,
    decision, notes: notes.trim() || null, rule: ruleText || null,
  };
  for (const [logicalName, value] of Object.entries(mapping)) {
    const col = findExistingColumn(row, logicalName);
    if (col != null) payload[col] = value;
  }
  return payload;
}
