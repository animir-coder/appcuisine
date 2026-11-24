// Couche données "local d'abord" : tout est lu/écrit localement (fonctionne hors ligne).
// Quand le foyer est connecté, chaque modification est détectée élément par élément
// et mise en file d'attente (pending) jusqu'à l'envoi par sync.js.
const KEY = 'cuisine.v1', META = 'cuisine.sync';
const empty = () => ({ recipes: [], stock: [], shopping: [], recurrents: [], catalog: {}, updatedAt: 0 });
const emptyMeta = () => ({ tracking: false, shadow: {}, pending: {}, seq: 0, lastPull: '' });

function read(k, def) {
  try { return { ...def(), ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return def(); }
}
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.error(e); } }

let state = read(KEY, empty);
let meta = read(META, emptyMeta);
const subs = new Set();

export const get = () => state;
export const subscribe = f => subs.add(f);
const notify = () => subs.forEach(f => f(state));
function persist() { write(KEY, state); notify(); }

export function update(fn) { fn(state); state.updatedAt = Date.now(); track(); persist(); }
export const snapshot = () => JSON.stringify(state);
export function restore(snap) { state = { ...empty(), ...JSON.parse(snap) }; track(); persist(); }
export function reset() { state = empty(); track(); persist(); }

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// Normalise un nom pour comparer "Tomates" et "tomate", "Œufs" et "oeuf".
export const norm = s => String(s || '')
  .toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  .split(' ').map(w => w.length > 3 ? w.replace(/(s|x)$/, '') : w).join(' ');

// ---------- éléments synchronisés ----------
const LISTS = { recipe: 'recipes', stock: 'stock', shopping: 'shopping', recurrent: 'recurrents' };
const idOf = (kind, e) => kind === 'recurrent' ? norm(e.name) : e.id;
function entities(st) {
  const m = new Map();
  for (const [kind, f] of Object.entries(LISTS)) st[f].forEach(e => m.set(kind + ':' + idOf(kind, e), e));
  Object.entries(st.catalog).forEach(([id, v]) => m.set('catalog:' + id, v));
  return m;
}
function putEntity(st, kind, id, data) {
  if (kind === 'catalog') { st.catalog[id] = data; return; }
  const f = LISTS[kind]; if (!f) return;
  const i = st[f].findIndex(e => idOf(kind, e) === id);
  if (i >= 0) st[f][i] = data; else st[f].push(data);
}
function removeEntity(st, kind, id) {
  if (kind === 'catalog') { delete st.catalog[id]; return; }
  const f = LISTS[kind]; if (!f) return;
  st[f] = st[f].filter(e => idOf(kind, e) !== id);
}

let onPending = () => {};
export const onPendingChange = f => { onPending = f; };
const saveMeta = () => write(META, meta);

function track() {
  if (!meta.tracking) return;
  const ents = entities(state);
  let changed = false;
  for (const [k, v] of ents) {
    const j = JSON.stringify(v);
    if (meta.shadow[k] !== j) { meta.shadow[k] = j; meta.pending[k] = { data: JSON.parse(j), seq: ++meta.seq }; changed = true; }
  }
  for (const k of Object.keys(meta.shadow)) {
    if (!ents.has(k)) { delete meta.shadow[k]; meta.pending[k] = { deleted: true, seq: ++meta.seq }; changed = true; }
  }
  if (changed) { saveMeta(); onPending(); }
}

export const syncMeta = () => meta;
export const pendingCount = () => Object.keys(meta.pending).length;

// mode 'upload' : nouveau foyer, on envoie tout le local.
// mode 'replace' : on rejoint un foyer, on repart de ses données.
export function startTracking(mode) {
  meta = { ...emptyMeta(), tracking: true };
  if (mode === 'replace') { state = empty(); write(KEY, state); }
  saveMeta();
  track();
  notify();
}
export function stopTracking() { meta = emptyMeta(); saveMeta(); notify(); }

// Copie des éléments à envoyer (avec leur numéro de version locale)
export const takePending = () => JSON.parse(JSON.stringify(meta.pending));
export function ackPending(sent) {
  for (const [k, v] of Object.entries(sent)) if (meta.pending[k]?.seq === v.seq) delete meta.pending[k];
  saveMeta();
}

// Changements reçus du serveur. Une modif locale pas encore envoyée garde la priorité.
export function applyRemote(rows) {
  let changed = false;
  for (const r of rows) {
    if (r.updated_at && r.updated_at > meta.lastPull) meta.lastPull = r.updated_at;
    const k = r.kind + ':' + r.id;
    if (meta.pending[k]) continue;
    if (r.deleted) {
      if (k in meta.shadow) { removeEntity(state, r.kind, r.id); delete meta.shadow[k]; changed = true; }
    } else {
      const j = JSON.stringify(r.data);
      if (meta.shadow[k] !== j) { putEntity(state, r.kind, r.id, r.data); meta.shadow[k] = j; changed = true; }
    }
  }
  saveMeta();
  if (changed) persist();
  return changed;
}
