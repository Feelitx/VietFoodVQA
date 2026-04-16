// KG Triple Verification SPA
export {};

const CONTROLS_ID = 'sidebar-controls';
const ROOT_ID = 'app-root';

const TRIPLE_OPTS: Record<string, string> = { valid:'Valid', invalid:'Invalid', unsure:'Unsure' };
const TRIPLE_CAPTIONS: Record<string, string> = {
  valid:'Triple đúng và tiếp tục dùng.', invalid:'Triple sai, không nên dùng.',
  unsure:'Chưa đủ chắc để kết luận.',
};

// ── State ─────────────────────────────────────────────────────────────────────
let allIds: string[] = [];
let tripleMap: Record<string, any> = {};
let currentId: string = '';
let relations: string[] = [];
let globalProg = { verified_count: 0, unverified_count: 0 };

function renderProgressBar() {
  let container = document.getElementById('main-progress');
  if (!container) {
    container = document.createElement('div');
    container.id = 'main-progress';
    const title = document.querySelector('.page-title');
    if (title) title.insertAdjacentElement('afterend', container);
  }
  const total = globalProg.verified_count + globalProg.unverified_count;
  const pct = total ? Math.round((globalProg.verified_count / total) * 100) : 0;
  container.innerHTML = `
    <div class="metrics" style="margin-bottom:24px; gap:8px;">
      <div class="metric" style="padding:15px; min-width:unset;"><div class="metric-label" style="font-size:.70rem">Đã duyệt</div><div class="metric-value" style="font-size:1.5rem; font-weight:900">${globalProg.verified_count}</div></div>
      <div class="metric" style="padding:15px; min-width:unset;"><div class="metric-label" style="font-size:.70rem">Chưa duyệt</div><div class="metric-value" style="font-size:1.5rem">${globalProg.unverified_count}</div></div>
    </div>
    <div class="progress-wrap" style="margin-top:-8px; margin-bottom:32px"><div class="progress-bar" style="width:${pct}%"></div></div>
  `;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
async function initSidebar() {
  try { relations = await (await fetch('/api/meta/relations')).json(); } catch { relations = []; }

  try { globalProg = await (await fetch('/api/kg/progress')).json(); } catch {}
  renderProgressBar();

  const el = document.getElementById(CONTROLS_ID)!;
  el.innerHTML = `
    <div class="card-title" style="margin-top:4px">Lọc Triples</div>
    <div class="form-group">
      <label>is_checked</label>
      <select id="sb-checked"><option>Tất cả</option><option>True</option><option value="False" selected>False</option></select>
    </div>
    <div class="form-group">
      <label>is_drop</label>
      <select id="sb-drop"><option selected>Tất cả</option><option>True</option><option>False</option></select>
    </div>
    <div class="cols2" style="gap:10px">
      <div class="form-group">
        <label>ID Từ</label>
        <input type="number" id="sb-start" placeholder="Từ" />
      </div>
      <div class="form-group">
        <label>ID Đến</label>
        <input type="number" id="sb-end" placeholder="Đến" />
      </div>
    </div>
    <div class="form-group">
      <label>Relation</label>
      <select id="sb-relation"><option>Tất cả</option>${relations.map(r=>`<option>${r}</option>`).join('')}</select>
    </div>
    <div class="form-group">
      <label>Tìm subject/target/relation</label>
      <input type="text" id="sb-search" placeholder="Tìm kiếm..." />
    </div>
    <button class="btn btn-secondary btn-full" id="sb-load" style="margin-bottom:12px">Tải danh sách</button>
    <div class="nav-divider"></div>
    <div class="form-group" style="margin-top:10px">
      <label>Chọn triple</label>
      <select id="sb-triple-select" class="list-select"><option>— chưa tải —</option></select>
    </div>
    <div class="nav-pos" id="sb-pos"></div>
  `;
  document.getElementById('sb-load')!.onclick = loadList;
  document.getElementById('sb-triple-select')!.onchange = (e) => {
    const id = (e.target as HTMLSelectElement).value;
    if (id) selectTriple(id);
  };
}

function getFilters() {
  return {
    is_checked: (document.getElementById('sb-checked') as HTMLSelectElement)?.value ?? 'Tất cả',
    is_drop: (document.getElementById('sb-drop') as HTMLSelectElement)?.value ?? 'Tất cả',
    relation: (document.getElementById('sb-relation') as HTMLSelectElement)?.value ?? 'Tất cả',
    search: (document.getElementById('sb-search') as HTMLInputElement)?.value ?? '',
    start_id: (document.getElementById('sb-start') as HTMLInputElement)?.value ?? '',
    end_id: (document.getElementById('sb-end') as HTMLInputElement)?.value ?? ''
  };
}

async function loadList() {
  const f = getFilters();
  const p = new URLSearchParams({ is_checked:f.is_checked, is_drop:f.is_drop, relation:f.relation, search:f.search });
  if (f.start_id) p.set('start_id', f.start_id);
  if (f.end_id) p.set('end_id', f.end_id);
  setRoot('<div class="loading-center"><div class="spinner"></div></div>');
  try {
    const rows: any[] = await (await fetch(`/api/kg/list?${p}`)).json();
    allIds = rows.map(r => r.triple_id);
    tripleMap = Object.fromEntries(rows.map(r => [r.triple_id, r]));
    
    // Fetch scope-specific progress ignoring is_checked
    const progParams = new URLSearchParams({ relation:f.relation, search:f.search });
    if (f.start_id) progParams.set('start_id', f.start_id);
    if (f.end_id) progParams.set('end_id', f.end_id);
    try { globalProg = await(await fetch(`/api/kg/progress?${progParams}`)).json(); } catch {}
    renderProgressBar();
  } catch {
    setRoot('<div class="alert alert-error">Không tải được danh sách triple.</div>');
    return;
  }
  updateSbSelect();
  if (allIds.length > 0) selectTriple(allIds[0]);
  else setRoot('<div class="alert alert-warning">Không có triple nào khớp điều kiện.</div>');
}

function updateSbSelect() {
  const sel = document.getElementById('sb-triple-select') as HTMLSelectElement;
  if (!sel) return;
  sel.innerHTML = allIds.map(id => {
    const r = tripleMap[String(id)] ?? {};
    const preview = `${r.subject} — ${r.relation} — ${r.target}`.slice(0, 80);
    return `<option value="${id}">#${id} | ${preview}</option>`;
  }).join('');
  if (currentId) sel.value = currentId;
}

function updatePos() {
  const el = document.getElementById('sb-pos');
  if (!el) return;
  const i = allIds.findIndex(id => String(id) === String(currentId));
  el.textContent = i >= 0 ? `${i+1} / ${allIds.length}` : '';
}

async function selectTriple(id: string) {
  currentId = id;
  const sel = document.getElementById('sb-triple-select') as HTMLSelectElement;
  if (sel) sel.value = id;
  updatePos();
  renderTripleDetail(tripleMap[id]);
  // Also fetch linked VQAs in background
  fetch(`/api/kg/linked_vqas?triple_id=${id}`)
    .then(r => r.json())
    .then(renderLinkedVqas)
    .catch(() => {});
}

function setRoot(html: string) { const el = document.getElementById(ROOT_ID); if (el) el.innerHTML = html; }
function normText(v: any): string { return v == null ? '' : String(v).trim(); }

function renderTripleDetail(row: any) {
  if (!row) { setRoot('<div class="alert alert-error">Không tìm thấy triple.</div>'); return; }
  const chk = row.is_checked ? '<span class="badge badge-green">✓ Đã duyệt</span>' : '<span class="badge badge-yellow">○ Chưa duyệt</span>';
  const drp = row.is_drop ? '<span class="badge badge-red">🗑 Drop</span>' : '<span class="badge badge-blue">✅ Giữ lại</span>';
  const idx = allIds.findIndex(id => String(id) === String(currentId));

  let defaultVerdict = 'unsure';
  if (row.is_checked === true) defaultVerdict = row.is_drop ? 'invalid' : 'valid';

  const actOpts = Object.entries(TRIPLE_OPTS).map(([k,v]) =>
    `<label class="radio-opt${defaultVerdict===k?' checked':''}"><input type="radio" name="verdict" value="${k}" ${defaultVerdict===k?'checked':''}> ${v}</label>`
  ).join('');

  setRoot(`
    <div class="breadcrumb">
      <b>Triple #${row.triple_id}</b> ${chk} ${drp}
      <span class="muted">${idx+1}/${allIds.length}</span>
    </div>

    <div class="cols2" style="align-items:start">
      <div>
        <div class="card">
          <div class="card-title">Thông tin triple</div>
          <div class="form-group" style="margin-bottom:12px">
            <label style="display:flex; align-items:center; gap:6px; margin-bottom:6px"><span class="badge badge-gray">Subject</span></label>
            <textarea id="edit-sub" rows="2" style="resize:vertical; font-family:monospace; line-height:1.4">${normText(row.subject)}</textarea>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label style="display:flex; align-items:center; gap:6px; margin-bottom:6px"><span class="badge badge-blue">Relation</span></label>
            <select id="edit-rel" style="font-family:monospace">
              <option value="">-- Trống --</option>
              ${relations.map(r => `<option value="${r.replace(/"/g, '&quot;')}" ${r === row.relation ? 'selected' : ''}>${r}</option>`).join('')}
              ${row.relation && !relations.includes(row.relation) ? `<option value="${String(row.relation).replace(/"/g, '&quot;')}" selected>${row.relation} (Unknown)</option>` : ''}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label style="display:flex; align-items:center; gap:6px; margin-bottom:6px"><span class="badge badge-gray">Target</span></label>
            <textarea id="edit-targ" rows="2" style="resize:vertical; font-family:monospace; line-height:1.4">${normText(row.target)}</textarea>
          </div>
          ${row.evidence ? `<div class="muted" style="margin-bottom:6px"><b>Evidence:</b> ${normText(row.evidence)}</div>` : '<div class="muted">Không có evidence.</div>'}
          ${row.source_url && row.source_url !== 'LLM_Knowledge'
            ? `<a href="${row.source_url}" target="_blank" class="muted">🔗 Mở nguồn</a>`
            : row.source_url ? `<div class="muted">source_url: LLM_Knowledge</div>` : '<div class="muted">Không có source_url.</div>'}
        </div>

        <div class="card">
          <div class="card-title">Global verdict</div>
          <div class="radio-group">${actOpts}</div>
          <div class="muted" id="verdict-caption" style="margin-top:6px">${TRIPLE_CAPTIONS[defaultVerdict]}</div>
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">Linked VQAs</div>
          <div id="linked-vqas-area" class="custom-scrollbar" style="display:flex; gap:12px; overflow-x:auto; padding-bottom:8px">
            <div class="loading-center" style="width:100%"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>

    <hr/>
    <div class="sticky bottom-0 z-20 py-4 bg-slate-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-t border-slate-200 dark:border-white/10 -mx-6 px-6 md:-mx-10 md:px-10 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_-5px_30px_rgba(0,0,0,0.5)]">
      <div id="save-alert"></div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" id="btn-save-triple" style="flex:1">💾 Lưu triple</button>
        <button class="btn btn-secondary" id="btn-next-triple" ${idx+1>=allIds.length?'disabled':''}>Tiếp →</button>
      </div>
    </div>
  `);

  // Radio group
  document.querySelectorAll('input[name="verdict"]').forEach(inp => {
    inp.addEventListener('change', function(this: HTMLInputElement) {
      document.querySelectorAll('input[name="verdict"]').forEach(r => {
        (r.parentElement as HTMLElement).classList.remove('checked');
      });
      (this.parentElement as HTMLElement).classList.add('checked');
      const cap = document.getElementById('verdict-caption');
      if (cap) cap.textContent = TRIPLE_CAPTIONS[this.value] ?? '';
    });
  });

  document.getElementById('btn-save-triple')!.onclick = saveTriple;
  document.getElementById('btn-next-triple')!.onclick = () => {
    const next = allIds[idx + 1];
    if (next) selectTriple(String(allIds[idx + 1]));
  };
}

function renderLinkedVqas(rows: any[]) {
  const area = document.getElementById('linked-vqas-area');
  if (!area) return;
  if (!rows || !rows.length) {
    area.innerHTML = '<div class="muted">Chưa có linked VQA hoặc chưa có bảng vqa_kg_triple_map.</div>';
    return;
  }
  area.innerHTML = rows.slice(0, 20).map(row => {
    const badges: string[] = [];
    if (row.triple_review_status) badges.push(`<span class="badge badge-gray">${row.triple_review_status}</span>`);
    if (row.is_active_for_vqa === true) badges.push('<span class="badge badge-green">active</span>');
    else if (row.is_active_for_vqa === false) badges.push('<span class="badge badge-red">inactive</span>');
    if (row.is_retrieved) badges.push('<span class="badge badge-blue">retrieved</span>');
    if (row.is_used) badges.push('<span class="badge badge-yellow">used</span>');
    return `
      <div class="triple-card" style="flex:0 0 280px; margin-bottom:0">
        <div style="font-weight:600;font-size:.85rem">VQA #${row.vqa_id} | ${row.image_id ?? '-'} | ${row.qtype ?? '-'}</div>
        <div class="muted" style="margin:4px 0">${normText(row.question) || '(trống)'}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${badges.join('')}</div>
      </div>
    `;
  }).join('');

  area.onwheel = (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      area.scrollBy({ left: e.deltaY > 0 ? 300 : -300, behavior: 'smooth' });
    }
  };
}

async function saveTriple() {
  const btn = document.getElementById('btn-save-triple') as HTMLButtonElement;
  const alertEl = document.getElementById('save-alert')!;
  const verdict = (document.querySelector('input[name="verdict"]:checked') as HTMLInputElement)?.value;
  if (!verdict) {
    alertEl.innerHTML = '<div class="alert alert-error">Vui lòng chọn verdict.</div>';
    return;
  }
  
  const subInp = document.getElementById('edit-sub') as HTMLTextAreaElement;
  const relInp = document.getElementById('edit-rel') as HTMLSelectElement;
  const targInp = document.getElementById('edit-targ') as HTMLTextAreaElement;

  btn.disabled = true; btn.textContent = 'Đang lưu…';
  alertEl.innerHTML = '';

  try {
    const resp = await fetch(`/api/kg/${currentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        verdict,
        subject: subInp.value,
        relation: relInp.value,
        target: targInp.value
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error ?? 'Lỗi lưu');
    alertEl.innerHTML = '<div class="alert alert-success">✓ Đã lưu triple.</div>';
    // Update local state
    if (tripleMap[currentId]) {
      const wasChecked = tripleMap[currentId].is_checked;
      const isCheckedNow = verdict !== 'unsure';
      
      tripleMap[currentId].is_checked = isCheckedNow;
      tripleMap[currentId].is_drop = verdict === 'invalid';
      tripleMap[currentId].subject = subInp.value;
      tripleMap[currentId].relation = relInp.value;
      tripleMap[currentId].target = targInp.value;
      
      if (wasChecked !== isCheckedNow) {
        if (isCheckedNow) {
          globalProg.verified_count++;
          globalProg.unverified_count--;
        } else {
          globalProg.verified_count--;
          globalProg.unverified_count++;
        }
        renderProgressBar();
      }
    }
    if (verdict === 'unsure') {
      setTimeout(() => selectTriple(String(currentId)), 500);
    } else {
      const idx = allIds.findIndex(id => String(id) === String(currentId));
      if (idx + 1 < allIds.length) {
        setTimeout(() => selectTriple(String(allIds[idx + 1])), 500);
      }
    }
  } catch (err: any) {
    alertEl.innerHTML = `<div class="alert alert-error">Lỗi: ${err.message}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = '💾 Lưu triple';
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
await initSidebar();
loadList();
