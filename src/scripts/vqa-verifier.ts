// VQA Verification SPA
export {};

const CONTROLS_ID = 'sidebar-controls';
const ROOT_ID = 'app-root';

// ── Constants (mirror Python) ─────────────────────────────────────────────────
const VERIFY_OPTIONS: Record<string, Record<number, string>> = {
  q0: { 1:'1 — Triple sai/không liên quan (DROP)',2:'2 — Triple yếu/thiếu',3:'3 — Triple đúng',4:'4 — Triple tốt/hỗ trợ suy luận' },
  q1: { 1:'1 — Câu hỏi sai bản chất (DROP)',2:'2 — Câu hỏi mơ hồ (DROP)',3:'3 — Câu hỏi đúng chưa gọn',4:'4 — Câu hỏi rõ ràng và tốt' },
  q2: { 1:'1 — Đáp án đúng bị sai',2:'2 — Nhiều đáp án/distractor lệch',3:'3 — Đúng nhưng distractor yếu',4:'4 — Đúng và distractor tốt' },
};
const VERIFY_TITLES: Record<string, string> = { q0:'Q0: Triple Used Validity', q1:'Q1: Question Validity', q2:'Q2: Choice Quality' };
const TRIPLE_OPTS: Record<string, string> = { valid:'Valid', invalid:'Invalid', needs_edit:'Needs edit', unsure:'Unsure' };
const TRIPLE_CAPTIONS: Record<string, string> = {
  valid:'Triple đúng và tiếp tục dùng.', invalid:'Triple sai, không nên dùng.',
  needs_edit:'Cần sửa lại fact.', unsure:'Chưa đủ chắc để kết luận.',
};

// ── State ─────────────────────────────────────────────────────────────────────
let allVqaIds: number[] = [];
let vqaMeta: Record<number, any> = {};
let imageMap: Record<string, any> = {};
let currentVqaId: number = 0;
let fullVqaRow: any = null;
let qtypes: string[] = [];
let tripleDrafts: any[] = [];
let progress = { total_assigned: 0, verified_count: 0, unverified_count: 0 };
let activeTab = 'content';

// ── Sidebar ───────────────────────────────────────────────────────────────────
async function initSidebar() {
  try { qtypes = await (await fetch('/api/meta/qtypes')).json(); } catch { qtypes = []; }

  const el = document.getElementById(CONTROLS_ID)!;
  el.innerHTML = `
    <div class="card-title" style="margin-top:4px">Lọc VQA</div>
    <div class="form-group"><label>Từ VQA ID</label><input id="sb-start" type="number" value="1" min="1"/></div>
    <div class="form-group"><label>Đến VQA ID</label><input id="sb-end" type="number" value="1000" min="1"/></div>
    <div class="form-group">
      <label>is_drop</label>
      <select id="sb-drop"><option>Tất cả</option><option>True</option><option value="False" selected>False</option></select>
    </div>
    <div class="form-group">
      <label>is_checked</label>
      <select id="sb-checked"><option>Tất cả</option><option>True</option><option value="False" selected>False</option></select>
    </div>
    <div class="form-group">
      <label>qtype</label>
      <select id="sb-qtype"><option>Tất cả</option>${qtypes.map(q=>`<option>${q}</option>`).join('')}</select>
    </div>
    <div class="form-group">
      <label>split</label>
      <select id="sb-split"><option>Tất cả</option><option>train</option><option value="test">test</option><option value="validate" selected>validate</option></select>
    </div>
    <button class="btn btn-secondary btn-full" id="sb-load" style="margin-bottom:12px">Tải danh sách</button>
    <div class="nav-divider"></div>
    <div class="form-group" style="margin-top:10px">
      <label>Chọn VQA</label>
      <select id="sb-vqa-select" class="list-select" style="max-width:100%"><option>— chưa tải —</option></select>
    </div>
    <div class="nav-pos" id="sb-pos"></div>
  `;
  document.getElementById('sb-load')!.onclick = loadList;
  document.getElementById('sb-vqa-select')!.onchange = (e) => {
    const id = parseInt((e.target as HTMLSelectElement).value);
    if (id) selectVqa(id);
  };
}

function getFilters(): Record<string, string> {
  return {
    start: (document.getElementById('sb-start') as HTMLInputElement)?.value ?? '1',
    end: (document.getElementById('sb-end') as HTMLInputElement)?.value ?? '1000',
    is_drop: (document.getElementById('sb-drop') as HTMLSelectElement)?.value ?? 'Tất cả',
    is_checked: (document.getElementById('sb-checked') as HTMLSelectElement)?.value ?? 'Tất cả',
    qtype: (document.getElementById('sb-qtype') as HTMLSelectElement)?.value ?? 'Tất cả',
    split: (document.getElementById('sb-split') as HTMLSelectElement)?.value ?? 'Tất cả',
  };
}

async function loadList() {
  const f = getFilters();
  const p = new URLSearchParams({ start:f.start, end:f.end, is_drop:f.is_drop, is_checked:f.is_checked, qtype:f.qtype, split:f.split });
  setRoot('<div class="loading-center"><div class="spinner"></div></div>');
  try {
    const data = await (await fetch(`/api/vqa/list?${p}`)).json();
    allVqaIds = (data.vqa_rows ?? []).map((r:any)=>r.vqa_id);
    vqaMeta = Object.fromEntries((data.vqa_rows??[]).map((r:any)=>[r.vqa_id,r]));
    imageMap = data.image_map ?? {};
    progress = data.progress ?? progress;
  } catch {
    setRoot('<div class="alert alert-error">Không tải được danh sách VQA.</div>');
    return;
  }
  updateSbSelect();
  if (allVqaIds.length > 0) selectVqa(allVqaIds[0]);
  else setRoot('<div class="alert alert-warning">Không có VQA nào khớp điều kiện.</div>');
}

function updateSbSelect() {
  const sel = document.getElementById('sb-vqa-select') as HTMLSelectElement;
  if (!sel) return;
  sel.innerHTML = allVqaIds.map(id => {
    const r = vqaMeta[id] ?? {};
    const q = (r.question ?? '').slice(0, 50);
    return `<option value="${id}">#${id} | ${r.qtype??'-'} | ${r.image_id??'-'} | ${q}</option>`;
  }).join('');
  if (currentVqaId) sel.value = String(currentVqaId);
}

function updatePos() {
  const el = document.getElementById('sb-pos');
  if (!el) return;
  const i = allVqaIds.findIndex(id => String(id) === String(currentVqaId));
  el.textContent = i >= 0 ? `${i+1} / ${allVqaIds.length}` : '';
}

async function selectVqa(id: number) {
  currentVqaId = id;
  activeTab = 'content';
  tripleDrafts = [];
  const sel = document.getElementById('sb-vqa-select') as HTMLSelectElement;
  if (sel) sel.value = String(id);
  updatePos();
  setRoot('<div class="loading-center"><div class="spinner"></div></div>');
  try {
    fullVqaRow = await (await fetch(`/api/vqa/${id}`)).json();
    renderVqaDetail();
  } catch {
    setRoot('<div class="alert alert-error">Không tải được chi tiết VQA.</div>');
  }
}

// ── Evaluate rubric ───────────────────────────────────────────────────────────
function getScores(): Record<string, number> {
  return {
    q0: parseInt((document.getElementById('score-q0') as HTMLSelectElement)?.value ?? '3'),
    q1: parseInt((document.getElementById('score-q1') as HTMLSelectElement)?.value ?? '4'),
    q2: parseInt((document.getElementById('score-q2') as HTMLSelectElement)?.value ?? '3'),
  };
}

function evaluateVerifyRubric(scores: Record<string, number>) {
  const fired: string[] = [];
  let decision = 'KEEP';
  if (scores.q0 <= 2) { decision='DROP'; fired.push('Q0<=2'); }
  if (scores.q1 <= 2) { decision='DROP'; fired.push('Q1<=2'); }
  return { decision, rule: fired.length ? fired.join(' + ') : 'PASS' };
}

function getExistingVerifyValue(row: any, field: string, def: any): any {
  const candidates: Record<string, string[]> = {
    q0:['q0_score','verify_q0','score_q0'], q1:['q1_score','verify_q1','score_q1'],
    q2:['q2_score','verify_q2','score_q2'], decision:['verify_decision','review_decision','decision'],
    notes:['verify_notes','review_notes','notes','reviewer_note'], rule:['verify_rule','review_rule'],
  };
  for (const c of candidates[field]??[]) if (row[c]!=null) return row[c];
  return def;
}

// ── Choices helpers ───────────────────────────────────────────────────────────
function parseTripleList(value: any): any[] {
  if (!value) return [];
  const data = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return []; } })() : value;
  if (!Array.isArray(data)) return [];
  return data.filter((t: any) => t?.subject && t?.relation && t?.target);
}

function formatChoices(row: any): string {
  return `A. ${row.choice_a??''}\nB. ${row.choice_b??''}\nC. ${row.choice_c??''}\nD. ${row.choice_d??''}`;
}

function parseChoices(raw: string): { parsed: Record<string,string>; missing: string[] } {
  const lines = raw.split('\n').map(l=>l.trim()).filter(Boolean);
  const parsed: Record<string,string> = {};
  const fb: string[] = [];
  for (const line of lines) {
    if ('ABCD'.includes(line[0]?.toUpperCase()) && '.):- '.includes(line[1])) {
      parsed[line[0].toUpperCase()] = line.slice(2).replace(/^[.):\ -]+/,'').trim();
    } else fb.push(line);
  }
  if (!Object.keys(parsed).length && fb.length === 4) 'ABCD'.split('').forEach((k,i)=>{ parsed[k]=fb[i]; });
  return { parsed, missing: 'ABCD'.split('').filter(k=>!parsed[k]) };
}

// ── Main render ───────────────────────────────────────────────────────────────
function setRoot(html: string) { const el = document.getElementById(ROOT_ID); if (el) el.innerHTML = html; }

function renderVqaDetail() {
  const row = fullVqaRow;
  const imgRow = imageMap[row.image_id] ?? {};
  const idx = allVqaIds.findIndex(id => String(id) === String(currentVqaId));

  const defScores = {
    q0: getExistingVerifyValue(row,'q0',3),
    q1: getExistingVerifyValue(row,'q1',4),
    q2: getExistingVerifyValue(row,'q2',3),
  };
  const defDecision = String(getExistingVerifyValue(row,'decision','AUTO')).toUpperCase();
  const defNotes = getExistingVerifyValue(row,'notes','');

  const chk = row.is_checked ? '<span class="badge badge-green">✓ Đã duyệt</span>' : '<span class="badge badge-yellow">○ Chưa duyệt</span>';
  const drp = row.is_drop ? '<span class="badge badge-red">🗑 Drop</span>' : '<span class="badge badge-blue">✅ Giữ lại</span>';

  // Progress bar HTML
  const pct = progress.total_assigned ? Math.round((progress.verified_count / progress.total_assigned) * 100) : 0;

  const triplesUsed = parseTripleList(row.triples_used);
  const triplesRet = parseTripleList(row.triples_retrieved);
  const hasTriplesRet = triplesRet.length > 0;

  // If tripleDrafts not yet initialized for this VQA, init from triples_used
  if (!tripleDrafts.length && triplesUsed.length) {
    tripleDrafts = triplesUsed.map((t: any, idx: number) => ({
      old_triple_id: null,
      old_triple: t,
      action: 'valid',
      editor_note: '',
      edit_reason: '',
      edited_triple: { ...t },
    }));
  }

  const tabsHtml = `
    <div class="tabs" id="tab-bar">
      <button class="tab-btn ${activeTab==='content'?'active':''}" data-tab="content">Nội dung câu hỏi</button>
      <button class="tab-btn ${activeTab==='triples'?'active':''}" data-tab="triples">Triple used</button>
      ${hasTriplesRet ? `<button class="tab-btn ${activeTab==='retrieved'?'active':''}" data-tab="retrieved">Triples retrieved</button>` : ''}
      <button class="tab-btn ${activeTab==='verify'?'active':''}" data-tab="verify">Phiếu verify</button>
    </div>
  `;

  setRoot(`
    <div class="metrics">
      <div class="metric"><div class="metric-label">Đã verify</div><div class="metric-value">${progress.verified_count}</div></div>
      <div class="metric"><div class="metric-label">Chưa verify</div><div class="metric-value">${progress.unverified_count}</div></div>
      <div class="metric"><div class="metric-label">Tổng range</div><div class="metric-value">${progress.total_assigned}</div></div>
    </div>
    <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
    <div class="muted" style="margin-bottom:12px">Tiến độ: ${progress.verified_count}/${progress.total_assigned} (${pct}%)</div>

    <div class="breadcrumb">
      <b>VQA #${row.vqa_id}</b> | Ảnh: <b>${row.image_id}</b> | Split: ${row.split??'-'} | ${chk} ${drp}
      <span class="muted">${idx+1}/${allVqaIds.length}</span>
    </div>

    <div class="cols2" style="align-items:start">
      <div>
        <img class="img-preview" src="${imgRow.image_url??''}" alt="${row.image_id}" loading="lazy" />
        <div class="card" style="margin-top:12px">
          <div class="card-title">Thông tin ảnh</div>
          <div class="muted">ID: ${row.image_id}</div>
          <div class="muted">Món: ${(imgRow.food_items??[]).join(', ')||'(trống)'}</div>
          ${imgRow.image_desc ? `<div class="muted" style="margin-top:4px">${imgRow.image_desc}</div>` : ''}
        </div>
      </div>

      <div>
        ${tabsHtml}
        <div id="tab-content" class="tab-panel ${activeTab==='content'?'active':''}">
          ${renderContentTab(row)}
        </div>
        <div id="tab-triples" class="tab-panel ${activeTab==='triples'?'active':''}">
          ${renderTriplesUsedTab()}
        </div>
        ${hasTriplesRet ? `<div id="tab-retrieved" class="tab-panel ${activeTab==='retrieved'?'active':''}">
          ${renderTriplesReadonly(triplesRet, 'Triples retrieved')}
        </div>` : ''}
        <div id="tab-verify" class="tab-panel ${activeTab==='verify'?'active':''}">
          ${renderVerifyTab(defScores, defDecision, defNotes)}
        </div>
      </div>
    </div>

    <hr/>
    <div id="save-alert"></div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-primary" id="btn-save-vqa" style="flex:1">💾 Lưu VQA</button>
      <button class="btn btn-secondary" id="btn-next-vqa" ${idx+1>=allVqaIds.length?'disabled':''}>Tiếp →</button>
    </div>
  `);

  // Tab switching
  document.getElementById('tab-bar')!.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-tab')!;
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
      document.getElementById(`tab-${activeTab}`)?.classList.add('active');
    });
  });

  // Score change → update verify summary
  ['score-q0','score-q1','score-q2'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', refreshVerifySummary);
  });
  // Decision mode
  document.querySelectorAll('input[name="decision-mode"]').forEach(inp => {
    inp.addEventListener('change', refreshDecisionDisplay);
  });
  // Radio group styling for decision
  document.querySelectorAll('.radio-opt input[type="radio"]').forEach(inp => {
    inp.addEventListener('change', function(this: HTMLInputElement) {
      const name = this.name;
      document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
        (r.parentElement as HTMLElement).classList.remove('checked');
      });
      (this.parentElement as HTMLElement).classList.add('checked');
    });
  });

  // Triple action listeners
  setupTripleEvents();

  document.getElementById('btn-save-vqa')!.onclick = saveVqa;
  document.getElementById('btn-next-vqa')!.onclick = () => {
    const next = allVqaIds[idx + 1];
    if (next) selectVqa(next);
  };

  refreshVerifySummary();
}

function renderContentTab(row: any): string {
  const qOpts = qtypes.map(q => `<option${row.qtype===q?' selected':''}>${q}</option>`).join('');
  const choices = formatChoices(row);
  return `
    <div class="cols2" style="gap:8px">
      <div class="form-group">
        <label>Question type</label>
        <select id="qtype-input">${qOpts}</select>
      </div>
      <div class="form-group">
        <label>Đáp án đúng</label>
        <select id="answer-input">
          ${['A','B','C','D'].map(l=>`<option${row.answer===l?' selected':''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Question</label>
      <textarea id="question-input" style="min-height:90px">${row.question??''}</textarea>
    </div>
    <div class="form-group">
      <label>Choices (A./B./C./D.)</label>
      <textarea id="choices-input" style="min-height:110px">${choices}</textarea>
    </div>
    <details>
      <summary class="muted" style="cursor:pointer;margin-bottom:8px">Rationale (không bắt buộc)</summary>
      <textarea id="rationale-input" style="min-height:80px">${row.rationale??''}</textarea>
    </details>
  `;
}

function renderTriplesUsedTab(): string {
  if (!tripleDrafts.length) return '<div class="alert alert-info">VQA này không có triples_used.</div>';
  return tripleDrafts.map((d: any, i: number) => renderTripleDraftCard(d, i)).join('');
}

function renderTripleDraftCard(d: any, i: number): string {
  const t = d.old_triple;
  const text = `${t.subject} — ${t.relation} — ${t.target}`;
  const actOpts = Object.entries(TRIPLE_OPTS).map(([k,v]) =>
    `<label class="radio-opt${d.action===k?' checked':''}"><input type="radio" name="triple-action-${i}" value="${k}" ${d.action===k?'checked':''}> ${v}</label>`
  ).join('');

  const needsEdit = d.action === 'needs_edit';
  const editFields = needsEdit ? `
    <div class="form-group"><label>Lý do sửa</label><input type="text" id="edit-reason-${i}" value="${d.edit_reason??''}"/></div>
    <div class="cols3">
      <div class="form-group"><label>Subject</label><input type="text" id="edit-sub-${i}" value="${d.edited_triple.subject??t.subject}"/></div>
      <div class="form-group"><label>Relation</label><input type="text" id="edit-rel-${i}" value="${d.edited_triple.relation??t.relation}"/></div>
      <div class="form-group"><label>Target</label><input type="text" id="edit-tgt-${i}" value="${d.edited_triple.target??t.target}"/></div>
    </div>
    <div class="form-group"><label>Evidence</label><textarea id="edit-ev-${i}" style="min-height:60px">${d.edited_triple.evidence??t.evidence??''}</textarea></div>
    <div class="form-group"><label>Source URL</label><input type="text" id="edit-url-${i}" value="${d.edited_triple.source_url??t.source_url??''}"/></div>
  ` : '';

  return `
    <div class="triple-card" id="triple-card-${i}">
      <div class="triple-text">Triple ${i+1}: ${text}</div>
      ${t.evidence ? `<div class="muted">Evidence: ${t.evidence}</div>` : '<div class="muted">Không có evidence.</div>'}
      ${t.source_url && t.source_url!=='LLM_Knowledge'
        ? `<a href="${t.source_url}" target="_blank" class="muted" style="display:inline-block;margin-bottom:6px">🔗 Nguồn</a>`
        : (t.source_url ? `<div class="muted">source_url: ${t.source_url}</div>` : '<div class="muted">Không có source_url.</div>')}
      <div class="form-group">
        <label>Verdict</label>
        <div class="radio-group" id="triple-radios-${i}">${actOpts}</div>
        <div class="muted" id="triple-caption-${i}" style="margin-top:4px">${TRIPLE_CAPTIONS[d.action]}</div>
      </div>
      <div class="form-group"><label>Ghi chú</label><input type="text" id="triple-note-${i}" value="${d.editor_note??''}" placeholder="Ví dụ: target sai..."/></div>
      <div id="triple-edit-fields-${i}">${editFields}</div>
    </div>
  `;
}

function renderTriplesReadonly(triples: any[], title: string): string {
  if (!triples.length) return `<div class="alert alert-info">Không có triple để hiển thị.</div>`;
  return `<h3 style="margin-bottom:12px;font-size:.95rem">${title}</h3>` + triples.map((t,i) => `
    <div class="triple-card">
      <div class="triple-text">Triple ${i+1}: ${t.subject} — ${t.relation} — ${t.target}</div>
      ${t.evidence ? `<div class="muted">${t.evidence}</div>` : ''}
      ${t.source_url && t.source_url!=='LLM_Knowledge'
        ? `<a href="${t.source_url}" target="_blank" class="muted">🔗 Nguồn</a>` : ''}
    </div>
  `).join('');
}

function renderVerifyTab(defScores: any, defDecision: string, defNotes: string): string {
  const scoreHtml = (key: string, def: number) => `
    <div class="form-group">
      <label>${VERIFY_TITLES[key]}</label>
      <select id="score-${key}" class="score-select">
        ${[1,2,3,4].map(v=>`<option value="${v}"${v===def?' selected':''}>${VERIFY_OPTIONS[key][v]}</option>`).join('')}
      </select>
    </div>
  `;
  const decisionOpts = ['AUTO','KEEP','DROP'].map(d => {
    const cap = d==='AUTO'?'Theo rubric':d==='KEEP'?'Giữ lại':'Drop';
    const checked = defDecision===d||(!['KEEP','DROP'].includes(defDecision)&&d==='AUTO');
    return `<label class="radio-opt${checked?' checked':''}">
      <input type="radio" name="decision-mode" value="${d}" ${checked?'checked':''}> ${d} <span class="muted" style="font-size:.75rem">(${cap})</span>
    </label>`;
  }).join('');

  return `
    <div class="cols3">${scoreHtml('q0',defScores.q0)}${scoreHtml('q1',defScores.q1)}${scoreHtml('q2',defScores.q2)}</div>
    <div id="verify-summary"></div>
    <div class="form-group" style="margin-top:12px">
      <label>Quyết định cuối cùng</label>
      <div class="radio-group">${decisionOpts}</div>
    </div>
    <div class="alert alert-info" id="decision-display" style="margin-top:8px"></div>
    <div class="form-group" style="margin-top:8px">
      <label>Ghi chú verify</label>
      <textarea id="verify-notes" style="min-height:80px" placeholder="Ví dụ: distractor C quá yếu...">${defNotes}</textarea>
    </div>
    <div class="card" style="margin-top:8px">
      <div class="card-title">Rubric</div>
      <div class="muted"><b>Q0</b> ≤ 2 → DROP | <b>Q1</b> ≤ 2 → DROP | <b>Q2</b> độc lập</div>
    </div>
  `;
}

function refreshVerifySummary() {
  const scores = getScores();
  const avg = (scores.q0+scores.q1+scores.q2)/3;
  const fired: string[] = [];
  let decision = 'KEEP';
  if (scores.q0 <= 2) { decision='DROP'; fired.push('Q0<=2'); }
  if (scores.q1 <= 2) { decision='DROP'; fired.push('Q1<=2'); }

  const el = document.getElementById('verify-summary');
  if (el) {
    const cls = decision==='DROP'?'alert-error':'alert-success';
    const text = decision==='DROP'
      ? `Khuyến nghị: DROP (${fired.join(' + ')})`
      : 'Khuyến nghị: KEEP — không kích hoạt hard-drop rule';
    el.innerHTML = `
      <div class="metrics" style="margin-bottom:8px">
        <div class="metric"><div class="metric-label">Q0</div><div class="metric-value" style="font-size:1.2rem">${scores.q0}</div></div>
        <div class="metric"><div class="metric-label">Q1</div><div class="metric-value" style="font-size:1.2rem">${scores.q1}</div></div>
        <div class="metric"><div class="metric-label">Q2</div><div class="metric-value" style="font-size:1.2rem">${scores.q2}</div></div>
        <div class="metric"><div class="metric-label">Avg</div><div class="metric-value" style="font-size:1.2rem">${avg.toFixed(2)}</div></div>
      </div>
      <div class="alert ${cls}">${text}</div>
    `;
  }
  refreshDecisionDisplay();
}

function refreshDecisionDisplay() {
  const scores = getScores();
  const { decision: autoDecision } = evaluateVerifyRubric(scores);
  const mode = (document.querySelector('input[name="decision-mode"]:checked') as HTMLInputElement)?.value ?? 'AUTO';
  const final = mode === 'AUTO' ? autoDecision : mode;
  const el = document.getElementById('decision-display');
  if (el) el.innerHTML = `Kết quả sẽ lưu: <b>${final}</b>`;
}



function setupTripleEvents() {
  tripleDrafts.forEach((d: any, i: number) => {
    document.querySelectorAll(`input[name="triple-action-${i}"]`).forEach(inp => {
      inp.addEventListener('change', function(this: HTMLInputElement) {
        (this.parentElement as HTMLElement).classList.add('checked');
        tripleDrafts[i].action = this.value;
        // style siblings
        document.querySelectorAll(`input[name="triple-action-${i}"]`).forEach(r => {
          (r.parentElement as HTMLElement).classList[r===this?'add':'remove']('checked');
        });
        // caption
        const cap = document.getElementById(`triple-caption-${i}`);
        if (cap) cap.textContent = TRIPLE_CAPTIONS[this.value];
        // show/hide edit fields
        const editArea = document.getElementById(`triple-edit-fields-${i}`);
        if (editArea) {
          editArea.innerHTML = this.value === 'needs_edit' ? renderEditFields(i, d) : '';
        }
      });
    });
  });
}

function renderEditFields(i: number, d: any): string {
  const t = d.old_triple;
  return `
    <div class="form-group"><label>Lý do sửa</label><input type="text" id="edit-reason-${i}" value="${d.edit_reason??''}" placeholder="Ví dụ: relation sai..."/></div>
    <div class="cols3">
      <div class="form-group"><label>Subject</label><input type="text" id="edit-sub-${i}" value="${d.edited_triple?.subject??t.subject}"/></div>
      <div class="form-group"><label>Relation</label><input type="text" id="edit-rel-${i}" value="${d.edited_triple?.relation??t.relation}"/></div>
      <div class="form-group"><label>Target</label><input type="text" id="edit-tgt-${i}" value="${d.edited_triple?.target??t.target}"/></div>
    </div>
    <div class="form-group"><label>Evidence</label><textarea id="edit-ev-${i}" style="min-height:60px">${d.edited_triple?.evidence??t.evidence??''}</textarea></div>
    <div class="form-group"><label>Source URL</label><input type="text" id="edit-url-${i}" value="${d.edited_triple?.source_url??t.source_url??''}"/></div>
    <div class="alert alert-info" style="font-size:.8rem">
      Original: ${t.subject} — ${t.relation} — ${t.target}
    </div>
  `;
}

// ── Collect drafts from DOM ───────────────────────────────────────────────────
function collectDrafts(): any[] {
  return tripleDrafts.map((d: any, i: number) => {
    const action = (document.querySelector(`input[name="triple-action-${i}"]:checked`) as HTMLInputElement)?.value ?? d.action;
    const note = (document.getElementById(`triple-note-${i}`) as HTMLInputElement)?.value ?? '';
    const reason = (document.getElementById(`edit-reason-${i}`) as HTMLInputElement)?.value ?? '';
    const edited = {
      subject: (document.getElementById(`edit-sub-${i}`) as HTMLInputElement)?.value ?? d.old_triple.subject,
      relation: (document.getElementById(`edit-rel-${i}`) as HTMLInputElement)?.value ?? d.old_triple.relation,
      target: (document.getElementById(`edit-tgt-${i}`) as HTMLInputElement)?.value ?? d.old_triple.target,
      evidence: (document.getElementById(`edit-ev-${i}`) as HTMLTextAreaElement)?.value ?? null,
      source_url: (document.getElementById(`edit-url-${i}`) as HTMLInputElement)?.value ?? null,
    };
    return { ...d, action, editor_note: note, edit_reason: reason, edited_triple: edited };
  });
}

// ── Validate ─────────────────────────────────────────────────────────────────
function validateSave(drafts: any[]): string[] {
  const errs: string[] = [];
  const qtype = (document.getElementById('qtype-input') as HTMLSelectElement)?.value;
  const question = (document.getElementById('question-input') as HTMLTextAreaElement)?.value?.trim();
  const choices = (document.getElementById('choices-input') as HTMLTextAreaElement)?.value;
  if (!qtype) errs.push('Question type trống');
  if (!question) errs.push('Question trống');
  const { parsed, missing } = parseChoices(choices ?? '');
  if (missing.length) errs.push(`Choices chưa đủ: ${missing.join(', ')}`);
  drafts.forEach((d, i) => {
    if (d.action === 'needs_edit') {
      if (!d.edited_triple.subject?.trim() || !d.edited_triple.relation?.trim() || !d.edited_triple.target?.trim()) {
        errs.push(`Triple ${i+1}: subject/relation/target không được trống`);
      }
      if (d.edited_triple.subject === d.old_triple.subject &&
          d.edited_triple.relation === d.old_triple.relation &&
          d.edited_triple.target === d.old_triple.target) {
        errs.push(`Triple ${i+1}: chọn Needs edit nhưng không thay đổi nội dung`);
      }
    }
  });
  return errs;
}

// ── Save ─────────────────────────────────────────────────────────────────────
async function saveVqa() {
  const btn = document.getElementById('btn-save-vqa') as HTMLButtonElement;
  const alertEl = document.getElementById('save-alert')!;
  const drafts = collectDrafts();
  const errs = validateSave(drafts);
  if (errs.length) {
    alertEl.innerHTML = `<div class="alert alert-error">${errs.join('<br/>')}</div>`;
    return;
  }

  btn.disabled = true; btn.textContent = 'Đang lưu…';
  alertEl.innerHTML = '';

  const scores = getScores();
  const { decision: autoDecision, rule } = evaluateVerifyRubric(scores);
  const mode = (document.querySelector('input[name="decision-mode"]:checked') as HTMLInputElement)?.value ?? 'AUTO';
  const decision = mode === 'AUTO' ? autoDecision : mode;
  const notes = (document.getElementById('verify-notes') as HTMLTextAreaElement)?.value ?? '';
  const { parsed } = parseChoices((document.getElementById('choices-input') as HTMLTextAreaElement)?.value ?? '');

  const body = {
    vqa_id: currentVqaId,
    qtype: (document.getElementById('qtype-input') as HTMLSelectElement).value,
    question: (document.getElementById('question-input') as HTMLTextAreaElement).value.trim(),
    choice_a: parsed['A'] ?? '',
    choice_b: parsed['B'] ?? '',
    choice_c: parsed['C'] ?? '',
    choice_d: parsed['D'] ?? '',
    answer: (document.getElementById('answer-input') as HTMLSelectElement).value,
    rationale: (document.getElementById('rationale-input') as HTMLTextAreaElement)?.value?.trim() ?? '',
    scores,
    decision,
    notes,
    rule_text: rule,
    triple_drafts: drafts,
    vqa_row: fullVqaRow,
  };

  try {
    const resp = await fetch('/api/vqa/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error ?? 'Lỗi lưu');
    alertEl.innerHTML = '<div class="alert alert-success">✓ Đã lưu VQA và xử lý triple review.</div>';
    progress.verified_count++;
    progress.unverified_count = Math.max(0, progress.unverified_count - 1);

    const idx = allVqaIds.findIndex(id => String(id) === String(currentVqaId));
    if (idx + 1 < allVqaIds.length) {
      setTimeout(() => selectVqa(allVqaIds[idx + 1]), 600);
    }
  } catch (err: any) {
    alertEl.innerHTML = `<div class="alert alert-error">Lỗi: ${err.message}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = '💾 Lưu VQA';
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
await initSidebar();
loadList();
