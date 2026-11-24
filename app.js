import * as S from './store.js';
import * as Y from './sync.js';
import { CATALOG, CATEGORIES, parseIngredient } from './catalog.js';
import { importFromUrl } from './importer.js';
import { AISLES, FRESH_DAYS, LOCS, LEVELS, LEVEL_LABEL, UNITS, guessAisle, DEMO, DEMO_STOCK, DEMO_RECURRENTS } from './data.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');
const DAY = 864e5;

// ---------- état d'écran (non persistant) ----------
let route = { name: 'recettes', id: null };
let review = null;          // candidats de l'écran de vérification
let stockFilter = 'tous';
let openStock = null;       // ligne de stock dépliée
let recipeQuery = '';
let catQuery = '', catCat = '', catOpen = null, importing = false;

// ---------- taille du foyer et portions ----------
const HH_SIZE = 'cuisine.foyer';
function hhSize() { try { return +localStorage.getItem(HH_SIZE) || 2; } catch { return 2; } }
function setHhSize(n) { try { localStorage.setItem(HH_SIZE, String(n)); } catch {} }
const people = r => r.people || hhSize();
const factor = r => r.servings ? people(r) / r.servings : 1;
function scaleQty(q, f, unit) {
  const n = parseFloat(String(q).replace(',', '.'));
  if (!q || isNaN(n) || f === 1) return q;
  let v = n * f;
  if (['g', 'ml'].includes(unit) && v >= 20) v = Math.round(v / 5) * 5;
  else if (!unit || ['pièce', 'tranche', 'gousse', 'boîte', 'sachet', 'botte'].includes(unit)) v = Math.max(1, Math.round(v * 2) / 2);
  else if (['c. à s.', 'c. à c.', 'pincée', 'verre', 'pot'].includes(unit)) v = Math.max(unit === 'pincée' ? 1 : 0.5, Math.round(v * 2) / 2);
  else if (['cl', 'g', 'ml'].includes(unit) && v >= 5) v = Math.round(v);
  else v = Math.round(v * 10) / 10;
  return String(v).replace('.', ',');
}
const qtyOf = (r, i) => scaleQty(i.qty, factor(r), i.unit);

// ---------- helpers métier ----------
const key = S.norm;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const isoIn = days => new Date(today().getTime() + days * DAY).toISOString().slice(0, 10);
const daysLeft = iso => Math.round((new Date(iso + 'T00:00:00') - today()) / DAY);

function cat(name) { return S.get().catalog[key(name)] || {}; }
function aisleOf(name, fallback) { return fallback || cat(name).aisle || guessAisle(key(name)); }
function learn(st, name, patch) {
  const k = key(name); if (!k) return;
  st.catalog[k] = { ...(st.catalog[k] || {}), name: name.trim(), ...patch };
}
const findStock = (st, name) => st.stock.find(x => key(x.name) === key(name));
function stockStatus(st, name) {
  const s = findStock(st, name);
  return !s ? 'absent' : s.level === 'presque' ? 'low' : 'ok';
}
const defaultLoc = aisle => aisle === 'Surgelés' ? 'congelo' : (aisle in FRESH_DAYS && aisle !== 'Boulangerie') ? 'frigo' : 'placard';

function addToStock(st, name, aisle) {
  const ex = findStock(st, name);
  if (ex) {
    const prev = { level: ex.level, expiry: ex.expiry };
    ex.level = 'plein';
    if (ex.fresh && ex.loc !== 'congelo') ex.expiry = isoIn(FRESH_DAYS[ex.aisle] ?? 5);
    return { type: 'refill', id: ex.id, prev };
  }
  const c = st.catalog[key(name)] || {};
  const loc = c.loc || defaultLoc(aisle);
  const fresh = c.fresh ?? (aisle in FRESH_DAYS);
  const item = { id: S.uid(), name, aisle, loc, level: 'plein', fresh, expiry: fresh && loc !== 'congelo' ? isoIn(FRESH_DAYS[aisle] ?? 5) : null, added: Date.now() };
  st.stock.push(item);
  return { type: 'new', id: item.id };
}
function undoStockOp(st, op) {
  if (!op) return;
  if (op.type === 'new') st.stock = st.stock.filter(x => x.id !== op.id);
  else { const s = st.stock.find(x => x.id === op.id); if (s) Object.assign(s, op.prev); }
}
function addToShopping(st, name, aisle, qty = '', source = 'manuel') {
  const k = key(name); if (!k) return false;
  const ex = st.shopping.find(i => !i.checked && key(i.name) === k);
  if (ex) { if (qty && !ex.qty.includes(qty)) ex.qty = ex.qty ? ex.qty + ' + ' + qty : qty; return false; }
  st.shopping.push({ id: S.uid(), name: name.trim(), aisle: aisleOf(name, aisle), qty, checked: false, source });
  learn(st, name, { aisle: aisleOf(name, aisle) });
  return true;
}
function fmtQty(list) {
  const by = {};
  for (const { q, u } of list) {
    const n = parseFloat(String(q).replace(',', '.'));
    if (isNaN(n)) continue;
    by[u] = (by[u] || 0) + n;
  }
  return Object.entries(by).map(([u, n]) => `${+n.toFixed(2)}${u ? ' ' + u : ''}`).join(' + ');
}
const missingFor = (st, r) => r.ingredients.filter(i => stockStatus(st, i.name) === 'absent');
const expiring = st => st.stock.filter(s => s.expiry && daysLeft(s.expiry) <= 2).sort((a, b) => a.expiry.localeCompare(b.expiry));

// ---------- toast avec annulation ----------
let toastTimer;
function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-a="undo">Annuler</button>' : ''}`;
  t.hidden = false; t._undo = undo;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; t._undo = null; }, 5000);
}

// ---------- navigation ----------
function go(hash) { location.hash = hash; }
function parse() {
  const [name, id] = (location.hash.slice(1) || 'recettes').split('/');
  route = { name, id };
}
window.addEventListener('hashchange', () => { parse(); if (route.name !== 'revue') review = null; render(); window.scrollTo(0, 0); });

// ---------- rendu ----------
const TITLES = { recettes: 'Recettes', recette: 'Recette', edit: 'Recette', courses: 'Courses', revue: 'Vérifier la liste', stock: 'Stock', idees: 'Que cuisiner ?', reglages: 'Réglages', catalogue: 'Catalogue' };
function render() {
  const st = S.get();
  // garder la saisie en cours si l'écran se redessine (ex. modif reçue d'un autre téléphone)
  const ae = document.activeElement, keep = ae && view.contains(ae) && ae.matches('input') ? { sel: ae.form?.id ? `#${ae.form.id} [name=${ae.name}]` : ae.dataset.input ? `[data-input=${ae.dataset.input}]` : null, v: ae.value } : null;
  $('#title').textContent = TITLES[route.name] || 'Cuisine';
  $('#back').hidden = !['recette', 'edit', 'revue', 'reglages', 'catalogue'].includes(route.name);
  const tab = { recette: 'recettes', edit: 'recettes', catalogue: 'recettes', revue: 'courses', reglages: '' }[route.name] ?? route.name;
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  const nShop = st.shopping.filter(i => !i.checked).length, nExp = expiring(st).length;
  $('#b-courses').textContent = nShop || ''; $('#b-stock').textContent = nExp || '';
  const fn = { recettes: vRecipes, recette: vRecipe, edit: vEdit, courses: vShopping, revue: vReview, stock: vStock, idees: vIdeas, reglages: vSettings, catalogue: vCatalog }[route.name] || vRecipes;
  view.innerHTML = fn(st);
  if (route.name === 'edit') initEdit();
  if (keep?.sel) { const i = view.querySelector(keep.sel); if (i) { i.value = keep.v; i.focus(); } }
  syncDot();
}
// pendant l'édition d'une recette, on ne redessine pas le formulaire
S.subscribe(() => route.name === 'edit' ? syncDot() : render());
Y.onStatus(() => route.name === 'reglages' ? render() : syncDot());
function syncDot() {
  const d = $('#sync'), s = Y.status, n = S.pendingCount();
  if (!s.household) { d.hidden = true; return; }
  d.hidden = false;
  const [cls, label] = !s.online ? ['off', `Hors ligne${n ? ` · ${n} modif. en attente` : ''}`] : s.error ? ['err', 'Erreur de synchro'] : n || s.syncing ? ['wait', 'Synchro…'] : ['ok', 'Synchronisé'];
  d.className = 'sync ' + cls; d.title = label; d.setAttribute('aria-label', label);
}

function empty(msg, action = '') { return `<div class="empty"><p>${msg}</p>${action}</div>`; }
const dot = s => `<span class="dot ${s}" title="${{ ok: 'En stock', low: 'Presque fini', absent: 'Manquant' }[s]}"></span>`;

// Recettes ------------------------------------------------------------
function vRecipes(st) {
  if (!st.recipes.length) return empty('Aucune recette pour l’instant.', `<a class="btn primary" href="#catalogue">Choisir dans le catalogue</a><button class="btn" data-a="new-recipe">+ Saisir une recette</button>`);
  const q = key(recipeQuery);
  const list = st.recipes.filter(r => !q || key(r.title).includes(q)).sort((a, b) => (b.selected - a.selected) || a.title.localeCompare(b.title));
  const nSel = st.recipes.filter(r => r.selected).length;
  return `
    <a class="btn wide" href="#catalogue">📚 Catalogue et recherche en ligne</a>
    ${st.recipes.length > 6 ? `<input class="search" type="search" placeholder="Chercher une recette" value="${esc(recipeQuery)}" data-input="rq">` : ''}
    <ul class="list">${list.map(r => {
      const miss = missingFor(st, r).length;
      return `<li class="row ${r.selected ? 'sel' : ''}">
        <button class="check ${r.selected ? 'on' : ''}" data-a="toggle-sel" data-id="${r.id}" aria-label="Sélectionner"></button>
        <a class="grow" href="#recette/${r.id}"><b>${esc(r.title)}</b><small>${r.ingredients.length} ingr. · ${miss ? `manque ${miss}` : 'tout en stock'}</small></a>
      </li>`;
    }).join('')}</ul>
    <div class="sticky">
      ${nSel ? `<button class="btn primary big" data-a="build-review">Préparer la liste (${nSel} recette${nSel > 1 ? 's' : ''})</button>` : `<p class="hint">Coche les recettes à faire, puis prépare la liste.</p>`}
    </div>
    <button class="fab" data-a="new-recipe" aria-label="Nouvelle recette">+</button>`;
}

function vRecipe(st) {
  const r = st.recipes.find(x => x.id === route.id);
  if (!r) return empty('Recette introuvable.');
  const miss = missingFor(st, r);
  return `
    <h2>${esc(r.title)}</h2>
    <div class="portions"><span>Pour</span>
      <button class="ico" data-a="people" data-id="${r.id}" data-d="-1" aria-label="Moins">−</button>
      <b>${people(r)}</b>
      <button class="ico" data-a="people" data-id="${r.id}" data-d="1" aria-label="Plus">+</button>
      <span>personne${people(r) > 1 ? 's' : ''}</span>${r.cooked ? `<small>cuisinée ${r.cooked}×</small>` : ''}</div>
    <div class="actions">
      <button class="btn ${r.selected ? '' : 'primary'}" data-a="toggle-sel" data-id="${r.id}">${r.selected ? '✓ Sélectionnée' : 'Sélectionner'}</button>
      <button class="btn primary" data-a="cook" data-id="${r.id}">J’ai cuisiné</button>
    </div>
    <h3>Ingrédients</h3>
    <ul class="ing">${r.ingredients.map(i => `<li>${dot(stockStatus(st, i.name))}<span class="grow">${esc(i.name)}</span><span class="muted">${esc([qtyOf(r, i), i.unit].filter(Boolean).join(' '))}</span></li>`).join('')}</ul>
    ${miss.length ? `<button class="btn" data-a="add-missing" data-id="${r.id}">Ajouter les ${miss.length} manquant${miss.length > 1 ? 's' : ''} à la liste</button>` : ''}
    ${r.source ? `<p class="hint"><a href="${esc(r.source)}" target="_blank" rel="noopener">Recette d’origine ↗</a></p>` : ''}
    ${r.steps.length ? `<h3>Étapes</h3><ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    <div class="actions end">
      <a class="btn" href="#edit/${r.id}">Modifier</a>
      <button class="btn danger" data-a="del-recipe" data-id="${r.id}">Supprimer</button>
    </div>`;
}

// Édition --------------------------------------------------------------
const ingRow = (i = {}) => `
  <div class="ingrow">
    <input name="n" placeholder="Ingrédient" list="dl-names" value="${esc(i.name)}" autocomplete="off">
    <input name="q" placeholder="Qté" inputmode="decimal" value="${esc(i.qty)}">
    <input name="u" placeholder="Unité" list="dl-units" value="${esc(i.unit)}">
    <select name="a">${AISLES.map(a => `<option ${a === i.aisle ? 'selected' : ''}>${a}</option>`).join('')}</select>
    <button type="button" class="x" data-a="del-ing" aria-label="Retirer">×</button>
  </div>`;
function vEdit(st) {
  const r = route.id === 'new' ? { title: '', servings: 4, ingredients: [], steps: [] } : st.recipes.find(x => x.id === route.id);
  if (!r) return empty('Recette introuvable.');
  const rows = r.ingredients.length ? r.ingredients : [{}, {}, {}];
  return `
    <form id="f-recipe" class="form">
      <label>Titre<input name="title" required value="${esc(r.title)}" placeholder="Ex. Gratin dauphinois"></label>
      <label>Portions de la recette d’origine<input name="servings" type="number" min="1" inputmode="numeric" value="${esc(r.servings)}"></label>
      <fieldset><legend>Ingrédients <small>(le rayon se devine tout seul)</small></legend>
        <div id="ings">${rows.map(ingRow).join('')}</div>
        <button type="button" class="btn" data-a="add-ing">+ Ingrédient</button>
      </fieldset>
      <label>Étapes <small>(une par ligne)</small><textarea name="steps" rows="6">${esc(r.steps.join('\n'))}</textarea></label>
      <div class="sticky"><button class="btn primary big">Enregistrer</button></div>
    </form>
    ${datalists(st)}`;
}
function datalists(st) {
  const names = new Set([...Object.values(st.catalog).map(c => c.name), ...st.stock.map(s => s.name)]);
  return `<datalist id="dl-names">${[...names].sort().map(n => `<option value="${esc(n)}">`).join('')}</datalist>
          <datalist id="dl-units">${UNITS.map(u => `<option value="${u}">`).join('')}</datalist>`;
}
function initEdit() {
  const f = $('#f-recipe'); if (!f) return;
  // le nom d'ingrédient remplit le rayon automatiquement
  f.addEventListener('change', e => {
    if (e.target.name !== 'n') return;
    const row = e.target.closest('.ingrow');
    row.querySelector('[name=a]').value = aisleOf(e.target.value);
    if (row === f.querySelector('#ings').lastElementChild && e.target.value) f.querySelector('#ings').insertAdjacentHTML('beforeend', ingRow());
  });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(f);
    const ingredients = [...f.querySelectorAll('.ingrow')].map(row => ({
      name: row.querySelector('[name=n]').value.trim(),
      qty: row.querySelector('[name=q]').value.trim(),
      unit: row.querySelector('[name=u]').value.trim(),
      aisle: row.querySelector('[name=a]').value,
    })).filter(i => i.name);
    const data = { title: fd.get('title').trim(), servings: +fd.get('servings') || null, ingredients, steps: fd.get('steps').split('\n').map(s => s.trim()).filter(Boolean) };
    let id = route.id;
    S.update(st => {
      ingredients.forEach(i => learn(st, i.name, { aisle: i.aisle }));
      if (id === 'new') { id = S.uid(); st.recipes.push({ id, selected: false, cooked: 0, people: hhSize(), ...data }); }
      else Object.assign(st.recipes.find(x => x.id === id), data);
    });
    go('recette/' + id);
  });
}

// Vérification de la liste -----------------------------------------------
function buildReview() {
  const st = S.get(), map = new Map();
  const onList = new Set(st.shopping.filter(i => !i.checked).map(i => key(i.name)));
  const add = (name, aisle, qty, unit, reason) => {
    const k = key(name); if (!k) return;
    let c = map.get(k);
    if (!c) {
      const s = stockStatus(st, name);
      c = { k, name, aisle: aisleOf(name, aisle), qtys: [], reasons: [], stock: s, onList: onList.has(k) };
      c.on = s !== 'ok' && !c.onList;
      map.set(k, c);
    }
    if (qty) c.qtys.push({ q: qty, u: unit || '' });
    if (!c.reasons.includes(reason)) c.reasons.push(reason);
  };
  st.recipes.filter(r => r.selected).forEach(r => r.ingredients.forEach(i => add(i.name, i.aisle, qtyOf(r, i), i.unit, `${r.title} (${people(r)} p.)`)));
  st.recurrents.forEach(r => add(r.name, r.aisle, null, null, 'Récurrent'));
  st.stock.filter(s => s.level === 'presque').forEach(s => add(s.name, s.aisle, null, null, 'Presque fini'));
  review = [...map.values()].sort((a, b) => AISLES.indexOf(a.aisle) - AISLES.indexOf(b.aisle) || a.name.localeCompare(b.name));
}
function vReview() {
  if (!review) buildReview();
  if (!review.length) return empty('Rien à acheter : sélectionne des recettes ou ajoute des récurrents.');
  const label = { ok: 'en stock', low: 'presque fini', absent: '' };
  const line = c => `<li class="row ${c.on ? 'sel' : 'off'}" data-a="rv-toggle" data-k="${esc(c.k)}">
      <span class="check ${c.on ? 'on' : ''}"></span>
      <span class="grow"><b>${esc(c.name)}</b> <span class="muted">${esc(fmtQty(c.qtys))}</span>
      <small>${esc(c.reasons.join(', '))}${c.onList ? ' · déjà sur la liste' : ''}${label[c.stock] ? ` · <em class="${c.stock}">${label[c.stock]}</em>` : ''}</small></span>
    </li>`;
  const toBuy = review.filter(c => c.stock !== 'ok' || c.on), have = review.filter(c => c.stock === 'ok' && !c.on);
  const n = review.filter(c => c.on).length;
  return `
    <p class="hint">Décoche ce que tu as déjà. Les articles en stock sont en bas.</p>
    <ul class="list">${toBuy.map(line).join('')}</ul>
    ${have.length ? `<h3>Déjà en stock (${have.length})</h3><ul class="list">${have.map(line).join('')}</ul>` : ''}
    <div class="sticky"><button class="btn primary big" data-a="rv-validate" ${n ? '' : 'disabled'}>Ajouter ${n} article${n > 1 ? 's' : ''} à la liste</button></div>`;
}

// Courses -------------------------------------------------------------------
function vShopping(st) {
  const groups = {};
  st.shopping.forEach(i => (groups[i.aisle] ||= []).push(i));
  const rec = new Set(st.recurrents.map(r => key(r.name)));
  const order = AISLES.filter(a => groups[a]);
  const nChecked = st.shopping.filter(i => i.checked).length;
  return `
    <form id="f-shop" class="addbar">
      <input name="n" placeholder="Ajouter un article" list="dl-names" autocomplete="off" enterkeyhint="done">
      <button class="btn primary">+</button>
    </form>
    ${st.recipes.some(r => r.selected) || st.recurrents.length ? `<a class="btn wide" href="#revue">Générer depuis les recettes sélectionnées</a>` : ''}
    ${!st.shopping.length ? empty('Liste vide.') : order.map(a => `
      <h3>${a}</h3>
      <ul class="list">${groups[a].sort((x, y) => x.checked - y.checked || x.name.localeCompare(y.name)).map(i => `
        <li class="row shop ${i.checked ? 'done' : ''}">
          <button class="check ${i.checked ? 'on' : ''}" data-a="shop-check" data-id="${i.id}" aria-label="Pris"></button>
          <span class="grow" data-a="shop-check" data-id="${i.id}"><b>${esc(i.name)}</b>${i.qty ? ` <span class="muted">${esc(i.qty)}</span>` : ''}</span>
          <button class="ico ${rec.has(key(i.name)) ? 'on' : ''}" data-a="toggle-rec" data-id="${i.id}" aria-label="Récurrent" title="Produit récurrent">⟳</button>
          <button class="ico" data-a="shop-del" data-id="${i.id}" aria-label="Supprimer">×</button>
        </li>`).join('')}</ul>`).join('')}
    ${nChecked ? `<div class="sticky"><button class="btn big" data-a="shop-clear">Terminer : retirer les ${nChecked} articles pris</button></div>` : ''}
    ${datalists(st)}`;
}

// Stock -----------------------------------------------------------------------
function vStock(st) {
  const exp = expiring(st);
  const list = st.stock.filter(s => stockFilter === 'tous' || s.loc === stockFilter)
    .sort((a, b) => (a.expiry || '9').localeCompare(b.expiry || '9') || a.name.localeCompare(b.name));
  const badge = s => {
    if (!s.expiry) return '';
    const d = daysLeft(s.expiry);
    return `<span class="exp ${d < 0 ? 'past' : d <= 2 ? 'soon' : ''}">${d < 0 ? 'périmé' : d === 0 ? "aujourd'hui" : d === 1 ? 'demain' : `J-${d}`}</span>`;
  };
  return `
    ${exp.length ? `<div class="alert"><b>À consommer vite</b> ${exp.map(s => esc(s.name)).join(', ')}
      ${(() => { const idea = st.recipes.find(r => r.ingredients.some(i => exp.some(s => key(s.name) === key(i.name)))); return idea ? `<a href="#recette/${idea.id}">→ ${esc(idea.title)}</a>` : ''; })()}</div>` : ''}
    <div class="seg">${['tous', ...Object.keys(LOCS)].map(l => `<button class="${stockFilter === l ? 'on' : ''}" data-a="stock-filter" data-l="${l}">${l === 'tous' ? 'Tout' : LOCS[l]} <small>${l === 'tous' ? st.stock.length : st.stock.filter(s => s.loc === l).length}</small></button>`).join('')}</div>
    <form id="f-stock" class="addbar">
      <input name="n" placeholder="Ajouter au stock" list="dl-names" autocomplete="off" enterkeyhint="done">
      <button class="btn primary">+</button>
    </form>
    ${!list.length ? empty('Rien ici.') : `<ul class="list">${list.map(s => `
      <li class="row stock">
        <span class="grow" data-a="stock-open" data-id="${s.id}"><b>${esc(s.name)}</b><small>${LOCS[s.loc]}</small></span>
        ${badge(s)}
        <button class="lvl ${s.level}" data-a="stock-level" data-id="${s.id}">${LEVEL_LABEL[s.level]}</button>
      </li>
      ${openStock === s.id ? `<li class="drawer">
        <div class="seg small">${Object.entries(LOCS).map(([k, v]) => `<button class="${s.loc === k ? 'on' : ''}" data-a="stock-loc" data-id="${s.id}" data-l="${k}">${v}</button>`).join('')}</div>
        <label class="inline">Périme le <input type="date" value="${s.expiry || ''}" data-change="stock-exp" data-id="${s.id}"></label>
        <div class="actions"><button class="btn" data-a="stock-to-list" data-id="${s.id}">À racheter</button><button class="btn danger" data-a="stock-del" data-id="${s.id}">Fini / jeté</button></div>
      </li>` : ''}`).join('')}</ul>`}
    <p class="hint">Touche le niveau pour le faire baisser. Touche un produit pour l’emplacement ou la date.</p>
    ${datalists(st)}`;
}

// Idées -------------------------------------------------------------------------
function vIdeas(st) {
  const help = `<p class="hint">Ce que tu peux cuisiner avec ton stock actuel. Les recettes qui utilisent un produit qui périme bientôt sont en tête.</p>`;
  if (!st.recipes.length) return help + empty('Ajoute des recettes pour voir ce que tu peux cuisiner.', '<a class="btn primary" href="#catalogue">Choisir dans le catalogue</a>');
  const scored = st.recipes.map(r => ({ r, miss: missingFor(st, r) }));
  const exp = new Set(expiring(st).map(s => key(s.name)));
  const card = ({ r, miss }) => `<li class="card">
      <a href="#recette/${r.id}"><b>${esc(r.title)}</b></a>
      ${r.ingredients.some(i => exp.has(key(i.name))) ? '<span class="tag soon">utilise du frais qui périme</span>' : ''}
      ${miss.length ? `<small>Manque : ${miss.map(i => esc(i.name)).join(', ')}</small>
        <button class="btn" data-a="add-missing" data-id="${r.id}">Ajouter les manquants à la liste</button>`
      : `<button class="btn primary" data-a="cook" data-id="${r.id}">J’ai cuisiné</button>`}
    </li>`;
  const sec = (t, arr) => arr.length ? `<h3>${t} <small>${arr.length}</small></h3><ul class="cards">${arr.map(card).join('')}</ul>` : '';
  const ok = scored.filter(x => !x.miss.length), m1 = scored.filter(x => x.miss.length === 1), m2 = scored.filter(x => x.miss.length === 2);
  const hasExp = x => x.r.ingredients.some(i => exp.has(key(i.name)));
  [ok, m1, m2].forEach(a => a.sort((x, y) => hasExp(y) - hasExp(x)));
  return help + ((sec('Faisables maintenant', ok) + sec('Il manque 1 ingrédient', m1) + sec('Il manque 2 ingrédients', m2)) || empty('Aucune recette à moins de 3 ingrédients manquants.'));
}

// Réglages -------------------------------------------------------------------------
function vSettings(st) {
  return `
    <h3>Taille du foyer</h3>
    <div class="portions"><button class="ico" data-a="hh-size" data-d="-1" aria-label="Moins">−</button><b>${hhSize()}</b><button class="ico" data-a="hh-size" data-d="1" aria-label="Plus">+</button><span>personne${hhSize() > 1 ? 's' : ''} par défaut pour les recettes</span></div>
    <h3>Produits récurrents</h3>
    <p class="hint">Proposés à chaque génération de liste s’ils ne sont pas en stock.</p>
    <form id="f-rec" class="addbar"><input name="n" placeholder="Ex. lait" list="dl-names" autocomplete="off"><button class="btn primary">+</button></form>
    <ul class="chips">${st.recurrents.map(r => `<li>${esc(r.name)} <button data-a="rec-del" data-k="${esc(key(r.name))}" aria-label="Retirer">×</button></li>`).join('') || '<li class="muted">Aucun</li>'}</ul>
    <h3>Partage du foyer</h3>
    ${vHousehold()}
    <h3>Données</h3>
    <div class="actions">
      <button class="btn" data-a="export">Exporter (JSON)</button>
      <label class="btn">Importer<input type="file" accept="application/json" data-change="import" hidden></label>
      <button class="btn" data-a="demo">Exemples</button>
      <button class="btn danger" data-a="reset">Tout effacer${Y.status.household ? ' (pour tout le foyer)' : ''}</button>
    </div>
    ${datalists(st)}`;
}

function vHousehold() {
  const s = Y.status, err = s.error ? `<p class="errmsg">${esc(s.error)}</p>` : '';
  if (!s.configured) return `<p class="hint">Synchro non configurée : les données restent sur ce téléphone (voir README, étape Supabase).</p>`;
  if (!s.user) return `
      <p class="hint">Connecte-toi pour partager recettes, stock et liste avec le foyer. Chaque membre a son propre compte.</p>
      <form id="f-auth" class="form">
        <input name="email" type="email" autocomplete="email" placeholder="ton@email.fr" value="${esc(s.email)}" required>
        <input name="pw" type="password" autocomplete="current-password" placeholder="Mot de passe (6 caractères min.)" minlength="6" required>
        <div class="actions"><button class="btn primary" value="in">Se connecter</button><button class="btn" value="up">Créer mon compte</button></div>
      </form>${err}`;
  if (!s.household) return `
      <p class="hint">Connecté : ${esc(s.user.email)}</p>
      <form id="f-join" class="addbar"><input name="n" placeholder="Code d’invitation" autocapitalize="characters" required><button class="btn primary">Rejoindre</button></form>
      <p class="hint">ou</p>
      <form id="f-create" class="addbar"><input name="n" placeholder="Nom du foyer" value="Maison"><button class="btn primary">Créer</button></form>
      <p class="hint">Créer : les données de ce téléphone deviennent celles du foyer. Rejoindre : ce téléphone reprend les données du foyer.</p>
      <button class="btn" data-a="sync-signout">Se déconnecter</button>${err}`;
  const n = S.pendingCount();
  return `
    <div class="card">
      <b>${esc(s.household.name)}</b>
      <small>${s.members || '?'} membre${s.members > 1 ? 's' : ''} · ${!s.online ? 'hors ligne' : n ? `${n} modif. en attente` : 'synchronisé'}</small>
      <p>Code d’invitation : <b class="code">${esc(s.household.invite_code)}</b></p>
      <button class="btn" data-a="sync-share">Partager le code</button>
    </div>
    <div class="actions"><button class="btn" data-a="sync-signout">Se déconnecter (${esc(s.user.email)})</button><button class="btn danger" data-a="sync-leave">Quitter le foyer</button></div>${err}`;
}

// Catalogue ----------------------------------------------------------------------
function vCatalog(st) {
  const q = key(catQuery), have = new Set(st.recipes.map(r => key(r.title)));
  const list = CATALOG.filter(c => (!catCat || c.c === catCat) && (!q || key(c.t).includes(q) || key(c.i).includes(q)));
  return `
    <form id="f-url" class="import">
      <b>Recette trouvée sur Internet ?</b>
      <small>Colle son lien (Marmiton, 750g, CuisineAZ…) ou partage-la vers l’app.</small>
      <div class="addbar"><input name="n" type="url" inputmode="url" placeholder="https://…" autocomplete="off"><button class="btn primary" ${importing ? 'disabled' : ''}>${importing ? '…' : 'Importer'}</button></div>
    </form>
    <input class="search" type="search" placeholder="Chercher : poulet, courgette, gratin…" value="${esc(catQuery)}" data-input="cq">
    ${catQuery.trim() ? `<a class="btn wide" href="https://www.marmiton.org/recettes/recherche.aspx?aqt=${encodeURIComponent(catQuery.trim())}" target="_blank" rel="noopener">Chercher « ${esc(catQuery.trim())} » sur Marmiton ↗</a>` : ''}
    <div class="catchips">${['', ...CATEGORIES].map(c => `<button class="chip ${catCat === c ? 'on' : ''}" data-a="cat-filter" data-c="${esc(c)}">${c || 'Toutes'}</button>`).join('')}</div>
    <ul class="list">${list.map(c => {
      const idx = CATALOG.indexOf(c), added = have.has(key(c.t));
      return `<li class="row">
        <span class="grow" data-a="cat-open" data-i="${idx}"><b>${esc(c.t)}</b><small>${c.c} · ${c.m} min · ${c.i.split(';').length} ingr.</small></span>
        <button class="btn ${added ? '' : 'primary'}" data-a="cat-add" data-i="${idx}" ${added ? 'disabled' : ''}>${added ? '✓' : '+'}</button>
      </li>${catOpen === idx ? `<li class="drawer"><small>Pour 2 : ${esc(c.i.split(';').map(x => x.trim()).join(', '))}</small></li>` : ''}`;
    }).join('') || '<li class="hint">Rien dans le catalogue : essaie sur Marmiton ci-dessus.</li>'}</ul>`;
}
function addRecipe(st, rec) {
  const id = S.uid();
  rec.ingredients.forEach(i => { i.aisle = i.aisle || aisleOf(i.name); learn(st, i.name, { aisle: i.aisle }); });
  st.recipes.push({ id, selected: false, cooked: 0, people: hhSize(), ...rec });
  return id;
}
async function doImport(url) {
  importing = true; render();
  try {
    const rec = await importFromUrl(url);
    let id; S.update(st => { id = addRecipe(st, rec); });
    importing = false; go('recette/' + id); toast('Recette importée : vérifie les ingrédients');
  } catch (e) { importing = false; render(); toast(e.message || 'Import impossible'); }
}

// ---------- actions ----------
const actions = {
  'new-recipe': () => go('edit/new'),
  'people': ({ id, d }) => S.update(st => { const r = st.recipes.find(x => x.id === id); r.people = Math.max(1, Math.min(20, people(r) + +d)); }),
  'hh-size': ({ d }) => { setHhSize(Math.max(1, Math.min(12, hhSize() + +d))); render(); },
  'cat-filter': ({ c }) => { catCat = c; render(); },
  'cat-open': ({ i }) => { catOpen = catOpen === +i ? null : +i; render(); },
  'cat-add': ({ i }) => {
    const c = CATALOG[+i];
    S.update(st => addRecipe(st, { title: c.t, servings: c.p, ingredients: c.i.split(';').map(parseIngredient), steps: c.s.split('|') }));
    toast(`« ${c.t} » ajoutée à tes recettes`);
  },
  'toggle-sel': ({ id }) => S.update(st => { const r = st.recipes.find(x => x.id === id); r.selected = !r.selected; }),
  'build-review': () => { review = null; go('revue'); },
  'del-recipe': ({ id }) => { const snap = S.snapshot(); S.update(st => { st.recipes = st.recipes.filter(x => x.id !== id); }); go('recettes'); toast('Recette supprimée', () => S.restore(snap)); },
  'add-ing': () => $('#ings').insertAdjacentHTML('beforeend', ingRow()),
  'del-ing': (_, el) => el.closest('.ingrow').remove(),
  'cook': ({ id }) => {
    const snap = S.snapshot(); let removed = 0, lowered = 0;
    S.update(st => {
      const r = st.recipes.find(x => x.id === id);
      r.ingredients.forEach(i => {
        const s = findStock(st, i.name); if (!s) return;
        // Hypothèse : le frais et le congelé sont consommés en entier ; le placard baisse d'un cran.
        if (s.loc === 'placard' && !s.fresh && s.level !== 'presque') { s.level = LEVELS[LEVELS.indexOf(s.level) + 1]; lowered++; }
        else { st.stock = st.stock.filter(x => x !== s); removed++; }
      });
      r.selected = false; r.cooked = (r.cooked || 0) + 1;
    });
    toast(`Stock mis à jour : ${removed} retiré${removed > 1 ? 's' : ''}, ${lowered} entamé${lowered > 1 ? 's' : ''}`, () => S.restore(snap));
  },
  'add-missing': ({ id }) => {
    let n = 0;
    S.update(st => { const r = st.recipes.find(x => x.id === id); missingFor(st, r).forEach(i => { if (addToShopping(st, i.name, i.aisle, [qtyOf(r, i), i.unit].filter(Boolean).join(' '), r.title)) n++; }); });
    toast(n ? `${n} article${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à la liste` : 'Déjà sur la liste');
  },
  'rv-toggle': ({ k }) => { const c = review.find(x => x.k === k); c.on = !c.on; render(); },
  'rv-validate': () => {
    const sel = review.filter(c => c.on);
    S.update(st => sel.forEach(c => addToShopping(st, c.name, c.aisle, fmtQty(c.qtys), c.reasons.join(', '))));
    review = null; go('courses'); toast(`${sel.length} article${sel.length > 1 ? 's' : ''} ajouté${sel.length > 1 ? 's' : ''}`);
  },
  'shop-check': ({ id }) => S.update(st => {
    const i = st.shopping.find(x => x.id === id);
    i.checked = !i.checked;
    if (i.checked) { i.stockOp = addToStock(st, i.name, i.aisle); if (navigator.vibrate) navigator.vibrate(15); }
    else { undoStockOp(st, i.stockOp); i.stockOp = null; }
  }),
  'shop-del': ({ id }) => S.update(st => { st.shopping = st.shopping.filter(x => x.id !== id); }),
  'shop-clear': () => { const snap = S.snapshot(); S.update(st => { st.shopping = st.shopping.filter(x => !x.checked); }); toast('Courses terminées, stock à jour', () => S.restore(snap)); },
  'toggle-rec': ({ id }) => S.update(st => {
    const i = st.shopping.find(x => x.id === id), k = key(i.name);
    if (st.recurrents.some(r => key(r.name) === k)) st.recurrents = st.recurrents.filter(r => key(r.name) !== k);
    else st.recurrents.push({ name: i.name, aisle: i.aisle });
  }),
  'rec-del': ({ k }) => S.update(st => { st.recurrents = st.recurrents.filter(r => key(r.name) !== k); }),
  'stock-filter': ({ l }) => { stockFilter = l; render(); },
  'stock-open': ({ id }) => { openStock = openStock === id ? null : id; render(); },
  'stock-level': ({ id }) => S.update(st => { const s = st.stock.find(x => x.id === id); s.level = LEVELS[(LEVELS.indexOf(s.level) + 1) % 3]; }),
  'stock-loc': ({ id, l }) => S.update(st => {
    const s = st.stock.find(x => x.id === id); s.loc = l;
    if (l === 'congelo') s.expiry = null;
    learn(st, s.name, { loc: l, aisle: s.aisle });
  }),
  'stock-del': ({ id }) => { const snap = S.snapshot(); S.update(st => { st.stock = st.stock.filter(x => x.id !== id); }); openStock = null; toast('Retiré du stock', () => S.restore(snap)); },
  'stock-to-list': ({ id }) => { S.update(st => { const s = st.stock.find(x => x.id === id); addToShopping(st, s.name, s.aisle); }); toast('Ajouté à la liste'); },
  'sync-signout': () => Y.signOut(),
  'sync-leave': () => Y.leaveHousehold(),
  'sync-share': () => {
    const code = Y.status.household.invite_code, text = `Rejoins notre foyer dans l’app Cuisine : Réglages > Partage du foyer, code ${code}`;
    if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard?.writeText(code).then(() => toast('Code copié'));
  },
  'undo': () => { const t = $('#toast'); t._undo?.(); t.hidden = true; },
  'export': () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([S.snapshot()], { type: 'application/json' }));
    a.download = `cuisine-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  },
  'demo': () => { loadDemo(); toast('Exemples chargés'); go('recettes'); },
  'reset': () => { const snap = S.snapshot(); S.reset(); toast('Tout est effacé', () => S.restore(snap)); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = actions[el.dataset.a]; if (!fn) return;
  e.preventDefault(); fn(el.dataset, el);
});
document.addEventListener('input', e => {
  const inp = e.target.dataset.input;
  if (inp === 'rq' || inp === 'cq') {
    if (inp === 'rq') recipeQuery = e.target.value; else catQuery = e.target.value;
    const pos = e.target.selectionStart; render();
    const i = $(`[data-input=${inp}]`); i.focus(); i.setSelectionRange(pos, pos);
  }
});
document.addEventListener('change', e => {
  const d = e.target.dataset;
  if (d.change === 'stock-exp') S.update(st => { const s = st.stock.find(x => x.id === d.id); s.expiry = e.target.value || null; s.fresh = !!e.target.value; learn(st, s.name, { fresh: s.fresh }); });
  if (d.change === 'import') e.target.files[0]?.text().then(t => { try { const snap = S.snapshot(); S.restore(t); toast('Données importées', () => S.restore(snap)); } catch { toast('Fichier invalide'); } });
});
document.addEventListener('submit', e => {
  const f = e.target, name = f.n?.value.trim();
  if (f.id === 'f-auth') {
    e.preventDefault();
    const fn = e.submitter?.value === 'up' ? Y.signUp : Y.signIn;
    f.querySelectorAll('button').forEach(b => b.disabled = true);
    fn(f.email.value, f.pw.value).finally(render); return;
  }
  const syncForms = { 'f-create': Y.createHousehold, 'f-join': Y.joinHousehold };
  if (f.id === 'f-url') { e.preventDefault(); if (name) doImport(name); return; }
  if (syncForms[f.id]) { e.preventDefault(); f.querySelector('button').disabled = true; syncForms[f.id](name || '').finally(render); return; }
  if (!['f-shop', 'f-stock', 'f-rec'].includes(f.id)) return;
  e.preventDefault(); if (!name) return;
  S.update(st => {
    const aisle = aisleOf(name);
    if (f.id === 'f-shop') addToShopping(st, name, aisle);
    if (f.id === 'f-stock') { addToStock(st, name, aisle); learn(st, name, { aisle }); }
    if (f.id === 'f-rec' && !st.recurrents.some(r => key(r.name) === key(name))) { st.recurrents.push({ name, aisle }); learn(st, name, { aisle }); }
  });
  const inp = document.querySelector(`#${f.id} [name=n]`); inp?.focus();
});
$('#back').addEventListener('click', () => history.length > 1 ? history.back() : go('recettes'));

function loadDemo() {
  S.update(st => {
    DEMO.forEach(d => {
      if (st.recipes.some(r => key(r.title) === key(d.title))) return;
      const ingredients = d.ingredients.map(([name, qty, unit, aisle]) => ({ name, qty: String(qty), unit, aisle }));
      ingredients.forEach(i => learn(st, i.name, { aisle: i.aisle }));
      st.recipes.push({ id: S.uid(), title: d.title, servings: d.servings, ingredients, steps: d.steps, selected: false, cooked: 0 });
    });
    DEMO_STOCK.forEach(([name, loc, level, days]) => {
      if (findStock(st, name)) return;
      st.stock.push({ id: S.uid(), name, aisle: aisleOf(name), loc, level, fresh: days != null, expiry: days != null ? isoIn(days) : null, added: Date.now() });
    });
    DEMO_RECURRENTS.forEach(([name, aisle]) => { if (!st.recurrents.some(r => key(r.name) === key(name))) st.recurrents.push({ name, aisle }); });
  });
}

// Partage vers l'app (Android) : ?url=… ou un lien dans ?text=…
{
  const sp = new URLSearchParams(location.search), shared = sp.get('url') || (sp.get('text') || '').match(/https?:\/\/\S+/)?.[0];
  if (shared) { history.replaceState(null, '', location.pathname + '#catalogue'); setTimeout(() => doImport(shared), 300); }
}
parse(); render(); Y.init();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
