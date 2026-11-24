/* Marketplace Deal Tracker — JavaScript Vanilla, persistencia en LocalStorage */
(() => {
'use strict';

/* ===== Constantes ===== */
const KEY = 'mdt.v1';
const STATUSES = ['Disponible','Consultado','Negociando','Apartado','Comprado','Descartado'];
const PRIOS = { Alta:'🔥 Alta', Media:'⭐ Media', Baja:'⚪ Baja' };
const $ = id => document.getElementById(id);
const Q = n => 'Q ' + Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ===== Estado + persistencia ===== */
const defaults = { budget: 5000, products: [], theme: 'light',
  filters: { q:'', status:'', prio:'', ship:'', bought:'', sort:'new' } };
let state = load();

function load() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY)) }; }
  catch { return structuredClone(defaults); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast('No se pudo guardar en LocalStorage'); }
}

/* ===== Cálculos ===== */
const total = p => p.price + (p.shipMode === 'none' ? 0 : p.ship);
const saving = p => (p.market > 0 ? p.market - p.price : null);
const active = () => state.products.filter(p => p.status !== 'Descartado'); // los descartados no cuentan como gasto

function opportunity(p) {
  const s = saving(p);
  if (s === null || s <= 0) return '❌ Sin ventaja económica';
  const pct = s / p.market;
  if (pct >= .3) return '🔥 Excelente Oferta';
  if (pct >= .15) return '💰 Buen Precio';
  return '⚠ Precio Regular';
}
function shipBanner(p) {
  if (p.shipMode === 'none') return '<div class="shipbar none">📍 SIN ENVÍO · RECOGER EN PERSONA</div>';
  if (p.ship > 0) return `<div class="shipbar paid">🚚 ENVÍO ${Q(p.ship).toUpperCase()}</div>`;
  return '<div class="shipbar free">🚚 ENVÍO GRATIS</div>';
}

/* ===== Filtros y orden ===== */
function visible() {
  const f = state.filters, q = f.q.trim().toLowerCase();
  let list = state.products.filter(p => {
    if (q && !`${p.title} ${p.desc} ${p.status}`.toLowerCase().includes(q)) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.prio && p.prio !== f.prio) return false;
    if (f.ship === 'con' && p.shipMode === 'none') return false;
    if (f.ship === 'sin' && p.shipMode !== 'none') return false;
    if (f.bought === 'comprado' && p.status !== 'Comprado') return false;
    if (f.bought === 'pendiente' && ['Comprado','Descartado'].includes(p.status)) return false;
    return true;
  });
  const sv = p => saving(p) ?? -Infinity;
  const sorts = { new:(a,b)=>b.date-a.date, old:(a,b)=>a.date-b.date, low:(a,b)=>total(a)-total(b),
    high:(a,b)=>total(b)-total(a), sMax:(a,b)=>sv(b)-sv(a), sMin:(a,b)=>sv(a)-sv(b) };
  return list.sort(sorts[f.sort] || sorts.new);
}

/* ===== Render ===== */
function render() {
  renderDash(); renderStats(); renderGrid(); save();
}

function renderDash() {
  const spent = active().reduce((s,p) => s + total(p), 0);
  const saved = active().reduce((s,p) => s + Math.max(saving(p) ?? 0, 0), 0);
  const pct = state.budget > 0 ? spent / state.budget * 100 : (spent > 0 ? 101 : 0);
  $('kSpent').textContent = Q(spent);
  $('kLeft').textContent = Q(state.budget - spent);
  $('kLeft').style.color = spent > state.budget ? 'var(--bad)' : '';
  $('kCount').textContent = state.products.length;
  $('kSaved').textContent = Q(saved);
  const bar = $('bar');
  bar.style.width = Math.min(pct, 100) + '%';
  bar.style.background = pct > 100 ? 'var(--hot)' : pct > 80 ? 'var(--bad)' : pct >= 50 ? 'var(--warn)' : 'var(--ok)';
  $('barText').textContent = pct > 100 ? `Presupuesto excedido (${pct.toFixed(0)}% usado)` : `${pct.toFixed(0)}% usado`;
  document.querySelector('.progress').setAttribute('aria-valuenow', Math.min(pct, 100).toFixed(0));
}

function renderStats() {
  const ps = state.products, n = ps.length;
  if (!n) { $('stats').innerHTML = ''; return; }
  const act = active(), spent = act.reduce((s,p) => s + total(p), 0);
  const cnt = st => ps.filter(p => p.status === st).length;
  const pend = ps.filter(p => !['Comprado','Descartado'].includes(p.status)).length;
  const ships = act.reduce((s,p) => s + (p.shipMode === 'none' ? 0 : p.ship), 0);
  const best = ps.reduce((m,p) => (saving(p) ?? -Infinity) > (m ? saving(m) : -Infinity) ? p : m, null);
  const byTotal = [...ps].sort((a,b) => total(a) - total(b));
  const items = [
    ['Total', n], ['Comprados', cnt('Comprado')], ['Pendientes', pend], ['Descartados', cnt('Descartado')],
    ['Promedio por producto', Q(act.length ? spent / act.length : 0)], ['Envíos', Q(ships)],
    ['Mayor ahorro', best && saving(best) > 0 ? Q(saving(best)) : '—'],
    ['Más caro', Q(total(byTotal[n-1]))], ['Más barato', Q(total(byTotal[0]))]
  ];
  $('stats').innerHTML = items.map(([k,v]) => `<div class="stat">${k}<b>${v}</b></div>`).join('');
}

function renderGrid() {
  const list = visible(), none = !state.products.length;
  $('empty').hidden = !none;
  $('grid').hidden = none;
  const f = state.filters, filtered = f.q || f.status || f.prio || f.ship || f.bought;
  $('count').hidden = none;
  $('count').innerHTML = `Mostrando ${list.length} de ${state.products.length} productos` +
    (filtered ? ' <button class="btn" id="btnClear">Limpiar filtros</button>' : '');
  $('grid').innerHTML = list.map(cardHTML).join('');
}

function cardHTML(p) {
  const s = saving(p), shipCls = p.shipMode === 'none' ? 'none' : p.ship > 0 ? 'paid' : 'free';
  const closed = p.status === 'Comprado' || p.status === 'Descartado';
  return `<article class="card ship-${shipCls} ${closed ? 'done' : ''}" data-id="${p.id}">
    <div class="thumb">${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.title)}" loading="lazy" onerror="this.remove()">` : '<span>Sin imagen</span>'}
      <span class="badge st-${p.status} stbadge">${p.status}</span>
      <span class="prio">${PRIOS[p.prio]}</span></div>
    ${shipBanner(p)}
    <div class="body">
      <h3>${esc(p.title)}</h3>
      <div class="price-main">${Q(total(p))}<small>total real</small></div>
      <div class="price-detail">Oferta ${Q(p.price)} + envío ${p.shipMode === 'none' ? '—' : Q(p.ship)}${s !== null && s > 0 ? ` · <span class="save">ahorras ${Q(s)}</span>` : ''}</div>
      ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
      <div class="opp">${opportunity(p)}</div>
    </div>
    <div class="card-actions">
      ${p.link ? '<button class="btn primary wide" data-act="open">Ver en Marketplace</button>' : '<span class="nolink">Sin enlace guardado</span>'}
      <button class="btn" data-act="edit">Editar</button>
      ${p.link ? '<button class="btn" data-act="copy">Copiar enlace</button>' : ''}
      <button class="btn" data-act="del">Eliminar</button>
    </div></article>`;
}

/* ===== Formulario (agregar / editar) ===== */
const form = $('form');
let editingId = null, pendingImg = null;

function openForm(p) {
  editingId = p ? p.id : null;
  $('formTitle').textContent = p ? 'Editar producto' : 'Nuevo producto';
  form.reset();
  const v = p || { title:'', desc:'', img:'', price:'', market:'', shipMode:'paid', ship:0, link:'', status:'Disponible', prio:'Media' };
  for (const k of ['title','desc','price','shipMode','ship','link','status','prio'])
    form.elements[k].value = v[k];
  pendingImg = null;
  form.elements.img.value = (v.img || '').startsWith('data:') ? '' : v.img;
  form.elements.market.value = v.market || '';
  $('dlgForm').showModal();
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const f = form.elements, num = x => Math.max(parseFloat(f[x].value) || 0, 0);
  let img = pendingImg || f.img.value.trim();
  if (!img && editingId) { const old = state.products.find(p => p.id === editingId).img || ''; if (old.startsWith('data:')) img = old; }
  const data = { title: f.title.value.trim(), desc: f.desc.value.trim(), img,
    price: num('price'), market: num('market'), shipMode: f.shipMode.value,
    ship: f.shipMode.value === 'paid' ? num('ship') : 0,
    link: f.link.value.trim(), status: f.status.value, prio: f.prio.value };
  if (editingId) Object.assign(state.products.find(p => p.id === editingId), data);
  else { state.filters = { ...defaults.filters }; syncFilters(); state.products.push({ id: crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now(), date: Date.now(), ...data }); }
  $('dlgForm').close(); render(); toast('Producto guardado');
});
$('formCancel').onclick = () => $('dlgForm').close();

/* Imagen subida desde el equipo: se reduce a ~700px para no llenar LocalStorage */
function readImage(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 700 / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = im.width * k; c.height = im.height * k;
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', .75));
      };
      im.onerror = () => res(null); im.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
form.elements.imgFile.addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  pendingImg = await readImage(f); toast(pendingImg ? 'Imagen lista' : 'No se pudo leer la imagen');
});

const FMAP = { q:'q', fStatus:'status', fPrio:'prio', fShip:'ship', fBought:'bought', sort:'sort' };
function syncFilters() { for (const [id, key] of Object.entries(FMAP)) $(id).value = state.filters[key]; }
$('count').addEventListener('click', e => {
  if (e.target.id === 'btnClear') { state.filters = { ...defaults.filters }; syncFilters(); render(); }
});

/* ===== Acciones en tarjetas ===== */
let pendingDelete = null;
$('grid').addEventListener('click', async e => {
  const btn = e.target.closest('[data-act]'); if (!btn) return;
  const p = state.products.find(x => x.id === btn.closest('.card').dataset.id);
  const act = btn.dataset.act;
  if (act === 'edit') openForm(p);
  if (act === 'open') window.open(p.link, '_blank', 'noopener');
  if (act === 'copy') {
    try { await navigator.clipboard.writeText(p.link); toast('Enlace copiado'); }
    catch { toast('No se pudo copiar el enlace'); }
  }
  if (act === 'del') { pendingDelete = p.id; $('confirmText').textContent = `Se eliminará "${p.title}". Esta acción no se puede deshacer.`; $('dlgConfirm').showModal(); }
});
$('confirmNo').onclick = () => $('dlgConfirm').close();
$('confirmYes').onclick = () => {
  state.products = state.products.filter(p => p.id !== pendingDelete);
  $('dlgConfirm').close(); render(); toast('Producto eliminado');
};

/* ===== Exportar / Importar ===== */
function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
const summary = () => {
  const spent = active().reduce((s,p) => s + total(p), 0);
  return { spent, left: state.budget - spent, saved: active().reduce((s,p) => s + Math.max(saving(p) ?? 0, 0), 0) };
};

function exportTXT() {
  const s = summary();
  const lines = ['MARKETPLACE DEAL TRACKER', '', `Presupuesto Inicial: ${Q(state.budget)}`, `Gastado: ${Q(s.spent)}`,
    `Disponible: ${Q(s.left)}`, '', 'PRODUCTOS', '',
    ...state.products.map(p => `${p.title}\nOferta: ${Q(p.price)} Envío: ${Q(p.ship)} Total: ${Q(total(p))} [${p.status}]\n` +
      (p.desc ? `Descripción: ${p.desc}\n` : '') + `Enlace: ${p.link || 'sin enlace'}\n`)];
  download('deal-tracker.txt', lines.join('\n'), 'text/plain');
}

function exportJSON() {
  download('deal-tracker-respaldo.json', JSON.stringify({ budget: state.budget, products: state.products }, null, 2), 'application/json');
}

function exportPDF() {
  if (!window.jspdf) return toast('jsPDF no cargó (se requiere conexión a internet)');
  const doc = new window.jspdf.jsPDF(), s = summary();
  doc.setFontSize(18); doc.text('Marketplace Deal Tracker', 14, 18);
  doc.setFontSize(10); doc.text('Exportado: ' + new Date().toLocaleString('es-GT'), 14, 25);
  doc.autoTable({ startY: 31, head: [['Resumen financiero', '']], theme: 'grid', headStyles: { fillColor: [15,118,110] },
    body: [['Presupuesto inicial', Q(state.budget)], ['Total gastado', Q(s.spent)], ['Disponible', Q(s.left)], ['Ahorro acumulado', Q(s.saved)]] });
  doc.autoTable({ startY: doc.lastAutoTable.finalY + 8, theme: 'striped', headStyles: { fillColor: [15,118,110] },
    head: [['Producto','Estado','Oferta','Envío','Total','Ahorro']],
    body: state.products.map(p => [p.title, p.status, Q(p.price), Q(p.ship), Q(total(p)), saving(p) !== null ? Q(saving(p)) : '—']),
    foot: [['Total (sin descartados)','','','', Q(s.spent), Q(s.saved)]], footStyles: { fillColor: [23,48,43] } });
  doc.save('deal-tracker.pdf');
}

function importJSON(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.products)) throw new Error();
      state.budget = Number(d.budget) || 0; state.products = d.products; render(); toast('Respaldo importado');
    } catch { toast('Archivo JSON no válido'); }
  };
  r.readAsText(file);
}

$('btnExport').onclick = e => { e.stopPropagation(); $('exportMenu').hidden = !$('exportMenu').hidden; };
document.addEventListener('click', () => $('exportMenu').hidden = true);
$('exportMenu').addEventListener('click', e => {
  const t = e.target.dataset.exp;
  if (t === 'txt') exportTXT();
  if (t === 'json') exportJSON();
  if (t === 'pdf') exportPDF();
  if (t === 'import') $('fileImport').click();
});
$('fileImport').onchange = e => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; };

/* ===== Controles, tema, toast ===== */
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  $('btnTheme').textContent = state.theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
}

function init() {
  const opts = (first, arr) => `<option value="">${first}</option>` + arr.map(a => `<option>${a}</option>`).join('');
  $('fStatus').innerHTML = opts('Todos los estados', STATUSES);
  $('fPrio').innerHTML = opts('Todas las prioridades', Object.keys(PRIOS));
  form.elements.status.innerHTML = STATUSES.map(s => `<option>${s}</option>`).join('');
  form.elements.prio.innerHTML = Object.entries(PRIOS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');

  syncFilters();
  for (const [id, key] of Object.entries(FMAP)) {
    $(id).addEventListener(id === 'q' ? 'input' : 'change', e => { state.filters[key] = e.target.value; render(); });
  }
  $('budgetInput').value = state.budget;
  $('budgetInput').addEventListener('input', e => { state.budget = Math.max(parseFloat(e.target.value) || 0, 0); render(); });
  $('btnAdd').onclick = $('btnFirst').onclick = () => openForm(null);
  $('btnTheme').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); save(); };
  applyTheme(); render();
}
init();
})();
