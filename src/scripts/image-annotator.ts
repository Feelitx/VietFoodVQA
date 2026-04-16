// Image Annotation SPA — mounts into #app-root and injects sidebar controls
export {};
const CONTROLS_ID = 'sidebar-controls';
const ROOT_ID = 'app-root';

interface ImageRow {
  image_id: string;
  image_url?: string;
  food_items?: string[];
  image_desc?: string;
  is_checked?: boolean;
  is_drop?: boolean;
}

// ── State ────────────────────────────────────────────────────────────────────
let allIds: string[] = [];
let currentId: string = '';
let currentRow: ImageRow | null = null;
let loading = false;

// ── Sidebar controls ─────────────────────────────────────────────────────────
function renderSidebarControls() {
  const el = document.getElementById(CONTROLS_ID)!;
  el.innerHTML = `
    <div class="card-title" style="margin-top:4px">Lọc ảnh</div>
    <div class="form-group">
      <label>Từ ID</label>
      <input id="sb-start" type="text" value="image000000" />
    </div>
    <div class="form-group">
      <label>Đến ID</label>
      <input id="sb-end" type="text" value="image001000" />
    </div>
    <div class="form-group">
      <label>is_drop</label>
      <select id="sb-drop">
        <option>Tất cả</option><option>True</option><option value="False" selected>False</option>
      </select>
    </div>
    <div class="form-group">
      <label>is_checked</label>
      <select id="sb-checked">
        <option>Tất cả</option><option>True</option><option value="False" selected>False</option>
      </select>
    </div>
    <button class="btn btn-secondary btn-full" id="sb-load" style="margin-bottom:12px">Tải danh sách</button>
    <div class="nav-divider"></div>
    <div class="form-group" style="margin-top:10px">
      <label>Chọn ảnh</label>
      <select id="sb-img-select" class="list-select"><option>— chưa tải —</option></select>
    </div>
    <div class="nav-pos" id="sb-pos"></div>
  `;
  document.getElementById('sb-load')!.onclick = loadList;
  document.getElementById('sb-img-select')!.onchange = (e) => {
    const sel = (e.target as HTMLSelectElement).value;
    if (sel) selectImage(sel);
  };
}

// ── API helpers ───────────────────────────────────────────────────────────────
function getFilters() {
  return {
    start: (document.getElementById('sb-start') as HTMLInputElement)?.value ?? 'image000000',
    end: (document.getElementById('sb-end') as HTMLInputElement)?.value ?? 'image001000',
    is_drop: (document.getElementById('sb-drop') as HTMLSelectElement)?.value ?? 'Tất cả',
    is_checked: (document.getElementById('sb-checked') as HTMLSelectElement)?.value ?? 'Tất cả',
  };
}

async function loadList() {
  const f = getFilters();
  const params = new URLSearchParams({ start: f.start, end: f.end, is_drop: f.is_drop, is_checked: f.is_checked });
  setRoot('<div class="loading-center"><div class="spinner"></div></div>');
  try {
    const resp = await fetch(`/api/images/list?${params}`);
    const rows: { image_id: string }[] = await resp.json();
    allIds = rows.map(r => r.image_id);
  } catch {
    setRoot('<div class="alert alert-error">Không tải được danh sách ảnh.</div>');
    return;
  }
  updateSelectList();
  if (allIds.length > 0) selectImage(allIds[0]);
  else setRoot('<div class="alert alert-warning">Không có ảnh nào khớp điều kiện.</div>');
}

function updateSelectList() {
  const sel = document.getElementById('sb-img-select') as HTMLSelectElement;
  if (!sel) return;
  sel.innerHTML = allIds.map(id => `<option value="${id}">${id}</option>`).join('');
  if (currentId) sel.value = currentId;
}

async function selectImage(id: string) {
  currentId = id;
  const sel = document.getElementById('sb-img-select') as HTMLSelectElement;
  if (sel) sel.value = id;
  updatePos();
  setRoot('<div class="loading-center"><div class="spinner"></div></div>');
  try {
    const resp = await fetch(`/api/images/${encodeURIComponent(id)}`);
    currentRow = await resp.json();
    renderImageDetail();
  } catch {
    setRoot('<div class="alert alert-error">Không tải được chi tiết ảnh.</div>');
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function updatePos() {
  const pos = document.getElementById('sb-pos');
  if (!pos) return;
  const idx = allIds.indexOf(currentId);
  pos.textContent = idx >= 0 ? `${idx + 1} / ${allIds.length}` : '';
}

function setRoot(html: string) {
  const el = document.getElementById(ROOT_ID);
  if (el) el.innerHTML = html;
}

function renderImageDetail() {
  const row = currentRow!;
  const idx = allIds.indexOf(currentId);
  const checkedBadge = row.is_checked
    ? '<span class="badge badge-green">✓ Đã duyệt</span>'
    : '<span class="badge badge-yellow">○ Chưa duyệt</span>';
  const dropBadge = row.is_drop
    ? '<span class="badge badge-red">🗑 Drop</span>'
    : '<span class="badge badge-blue">✅ Giữ lại</span>';

  const foods = (row.food_items ?? []).join('\n');
  const isDropDefault = row.is_drop ? 'no' : 'yes';

  setRoot(`
    <div class="breadcrumb">
      <b>${row.image_id}</b>
      ${checkedBadge} ${dropBadge}
      <span class="muted">${idx + 1}/${allIds.length}</span>
    </div>

    <div class="cols2">
      <div>
        <img id="img-preview" class="img-preview" src="${row.image_url ?? ''}" alt="${row.image_id}" loading="lazy" />
        <div style="margin-top:12px">
          <div class="form-group">
            <label>Giữ lại ảnh này?</label>
            <div class="radio-group" id="keep-radios">
              <label class="radio-opt${isDropDefault==='yes'?' checked':''}">
                <input type="radio" name="keep-img" value="yes" ${isDropDefault==='yes'?'checked':''}> Có
              </label>
              <label class="radio-opt${isDropDefault==='no'?' checked':''}">
                <input type="radio" name="keep-img" value="no" ${isDropDefault==='no'?'checked':''}> Không
              </label>
            </div>
            <div class="muted" style="margin-top:5px">Chọn Không nếu ảnh mờ, sai chủ đề.</div>
          </div>
        </div>
      </div>

      <div>
        <div class="form-group">
          <label>Danh sách món ăn (mỗi món một dòng)</label>
          <textarea id="foods-input" style="min-height:180px">${foods}</textarea>
        </div>
        <div class="form-group">
          <label>Mô tả / Ghi chú thêm (tuỳ chọn)</label>
          <textarea id="desc-input" style="min-height:90px">${row.image_desc ?? ''}</textarea>
        </div>
      </div>
    </div>

    <hr/>
    <div id="save-alert"></div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-primary" id="btn-save" style="flex:1">💾 Lưu</button>
      <button class="btn btn-secondary" id="btn-next" ${idx + 1 >= allIds.length ? 'disabled' : ''}>Tiếp →</button>
    </div>
  `);

  // Radio group styling
  document.querySelectorAll('input[name="keep-img"]').forEach(inp => {
    inp.addEventListener('change', () => {
      document.querySelectorAll('.radio-opt').forEach(el => el.classList.remove('checked'));
      (inp.parentElement as HTMLElement).classList.add('checked');
    });
  });

  document.getElementById('btn-save')!.onclick = saveImage;
  document.getElementById('btn-next')!.onclick = () => {
    const next = allIds[idx + 1];
    if (next) selectImage(next);
  };
}

async function saveImage() {
  const btn = document.getElementById('btn-save') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Đang lưu…';
  const alertEl = document.getElementById('save-alert')!;

  const foodsRaw = (document.getElementById('foods-input') as HTMLTextAreaElement).value;
  const desc = (document.getElementById('desc-input') as HTMLTextAreaElement).value.trim();
  const keepVal = (document.querySelector('input[name="keep-img"]:checked') as HTMLInputElement)?.value ?? 'yes';
  const foodList = foodsRaw.split('\n').map(s => s.trim()).filter(Boolean);

  try {
    const resp = await fetch(`/api/images/${encodeURIComponent(currentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ food_items: foodList, image_desc: desc || null, is_drop: keepVal === 'no' }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error ?? 'Lỗi lưu');
    alertEl.innerHTML = '<div class="alert alert-success">✓ Đã lưu thành công!</div>';

    // Advance to next
    const idx = allIds.indexOf(currentId);
    if (idx + 1 < allIds.length) {
      setTimeout(() => selectImage(allIds[idx + 1]), 500);
    }
  } catch (err: any) {
    alertEl.innerHTML = `<div class="alert alert-error">Lỗi: ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Lưu';
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
renderSidebarControls();
loadList();
