// Synchro foyer via Supabase : connexion par code reçu par e-mail, foyer partagé,
// envoi des modifs en file d'attente, réception en temps réel. Tout reste utilisable hors ligne.
import * as S from './store.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const HH = 'cuisine.household';
export const status = {
  configured: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
  user: null, household: null, step: 'email', email: '',
  online: navigator.onLine, syncing: false, error: '', members: 0,
};
try { status.household = JSON.parse(localStorage.getItem(HH) || 'null'); } catch {}

let sb = null, channel = null, flushTimer = null, listeners = new Set();
export const onStatus = f => listeners.add(f);
const emit = () => listeners.forEach(f => f(status));
const fail = (e) => { status.error = e?.message || String(e); emit(); };
const saveHH = () => { try { localStorage.setItem(HH, JSON.stringify(status.household)); } catch {} };

function loadLib() {
  if (window.supabase) return Promise.resolve();
  return new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'vendor/supabase.js'; s.onload = ok; s.onerror = ko;
    document.head.appendChild(s);
  });
}

export async function init() {
  if (!status.configured) return emit();
  try { await loadLib(); } catch { return fail('Bibliothèque de synchro indisponible'); }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const { data } = await sb.auth.getSession();
  status.user = data.session?.user ?? null;
  sb.auth.onAuthStateChange((_e, session) => { status.user = session?.user ?? null; emit(); });
  S.onPendingChange(scheduleFlush);
  window.addEventListener('online', () => { status.online = true; emit(); connect(); });
  window.addEventListener('offline', () => { status.online = false; emit(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { pull(); flush(); } });
  emit();
  connect();
}

// ---------- connexion ----------
export async function sendCode(email) {
  status.error = ''; status.email = email.trim();
  const { error } = await sb.auth.signInWithOtp({ email: status.email, options: { shouldCreateUser: true } });
  if (error) return fail(error);
  status.step = 'code'; emit();
}
export async function verifyCode(code) {
  status.error = '';
  const { data, error } = await sb.auth.verifyOtp({ email: status.email, token: code.trim(), type: 'email' });
  if (error) return fail('Code invalide ou expiré');
  status.user = data.user; status.step = 'email'; emit();
  await refreshHousehold();
}
export async function signOut() {
  await sb.auth.signOut();
  leaveLocal();
}
function leaveLocal() {
  channel && sb.removeChannel(channel); channel = null;
  status.household = null; saveHH(); S.stopTracking(); emit();
}

// ---------- foyer ----------
async function refreshHousehold() {
  // si l'utilisateur est déjà membre d'un foyer (ex. reconnexion), on le retrouve
  const { data } = await sb.from('households').select('*').limit(1);
  if (data?.[0] && !status.household) { status.household = data[0]; saveHH(); S.startTracking('replace'); connect(); }
  emit();
}
export async function createHousehold(name) {
  status.error = '';
  const { data, error } = await sb.rpc('create_household', { p_name: name });
  if (error) return fail(error);
  status.household = data; saveHH();
  S.startTracking('upload');   // les données de ce téléphone deviennent celles du foyer
  connect();
}
export async function joinHousehold(code) {
  status.error = '';
  const { data, error } = await sb.rpc('join_household', { p_code: code });
  if (error) return fail(error.message.includes('code inconnu') ? 'Code inconnu' : error);
  status.household = data; saveHH();
  S.startTracking('replace');  // on récupère les données du foyer
  connect();
}
export async function leaveHousehold() {
  if (!status.household) return;
  await sb.from('members').delete().eq('household_id', status.household.id).eq('user_id', status.user.id);
  leaveLocal();
}

// ---------- échanges ----------
async function connect() {
  if (!sb || !status.user || !status.household || !navigator.onLine) return emit();
  const { count } = await sb.from('members').select('*', { count: 'exact', head: true }).eq('household_id', status.household.id);
  status.members = count || 0;
  if (!channel) {
    channel = sb.channel('hh-' + status.household.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: 'household_id=eq.' + status.household.id },
        p => p.new && S.applyRemote([p.new]))
      .subscribe(st => { if (st === 'SUBSCRIBED') pull(); });
  }
  await flush();
  await pull();
}

async function pull() {
  if (!sb || !status.household || !status.user || !navigator.onLine) return;
  const hh = status.household.id;
  try {
    for (let from = 0; ; from += 1000) {
      let q = sb.from('entries').select('*').eq('household_id', hh).order('updated_at').range(from, from + 999);
      const since = S.syncMeta().lastPull;
      if (since && from === 0) q = q.gt('updated_at', since);
      const { data, error } = await q;
      if (error) throw error;
      S.applyRemote(data);
      if (data.length < 1000) break;
    }
    status.error = '';
  } catch (e) { fail(e); }
  emit();
}

function scheduleFlush() { emit(); clearTimeout(flushTimer); flushTimer = setTimeout(flush, 400); }
async function flush() {
  if (!sb || !status.household || !status.user || !navigator.onLine || status.syncing) return;
  const sent = S.takePending();
  const keys = Object.keys(sent);
  if (!keys.length) return emit();
  status.syncing = true; emit();
  try {
    const rows = keys.map(k => {
      const i = k.indexOf(':');
      return { household_id: status.household.id, kind: k.slice(0, i), id: k.slice(i + 1), data: sent[k].data ?? null, deleted: !!sent[k].deleted };
    });
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from('entries').upsert(rows.slice(i, i + 500));
      if (error) throw error;
    }
    S.ackPending(sent);
    status.error = '';
  } catch (e) { fail(e); }
  status.syncing = false; emit();
  if (S.pendingCount()) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, status.error ? 15000 : 400); }
}
