// Import d'une recette depuis un lien, via le relais Supabase "import-recipe".
import * as Y from './sync.js';
import { parseIngredient } from './catalog.js';

const UNITS = [
  [/^(kg|kilos?|kilogrammes?)/i, 'kg'], [/^(g|gr|grammes?)/i, 'g'], [/^(cl|centilitres?)/i, 'cl'], [/^(ml|millilitres?)/i, 'ml'], [/^(l|litres?)/i, 'l'],
  [/^(c\.?\s?à\.?\s?s\.?|cuill[eè]res?\s+à\s+soupe|càs|cas|cs)/i, 'c. à s.'], [/^(c\.?\s?à\.?\s?c\.?|cuill[eè]res?\s+à\s+caf[ée]|càc|cac|cc)/i, 'c. à c.'],
  [/^pinc[ée]es?/i, 'pincée'], [/^sachets?/i, 'sachet'], [/^bo[iî]tes?/i, 'boîte'], [/^tranches?/i, 'tranche'], [/^gousses?/i, 'gousse'],
  [/^bottes?/i, 'botte'], [/^verres?/i, 'verre'], [/^brins?/i, 'brin'], [/^feuilles?/i, 'feuille'], [/^pots?/i, 'pot'], [/^briques?/i, 'brique'],
];
const ENT = { '&amp;': '&', '&quot;': '"', '&#39;': '’', '&apos;': '’', '&nbsp;': ' ', '&lt;': '<', '&gt;': '>' };
const clean = s => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, e => ENT[e] ?? ' ').replace(/\s+/g, ' ').trim();

export function parseFr(raw) {
  let t = clean(raw).replace(/[½¼¾]/g, c => ({ '½': ' 0.5', '¼': ' 0.25', '¾': ' 0.75' }[c])).trim();
  let qty = '';
  const m = t.match(/^(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?(?:\s*(?:à|-)\s*\d+(?:[.,]\d+)?)?\s*/);
  if (m) {
    const n = parseFloat(m[1].replace(',', '.'));
    qty = String(m[2] ? +(n / +m[2]).toFixed(2) : n);
    t = t.slice(m[0].length);
  }
  let unit = '';
  for (const [re, u] of UNITS) {
    const mm = t.match(new RegExp(re.source + '(?=[\\s.]|$)', 'i'));
    if (mm) { unit = u; t = t.slice(mm[0].length).replace(/^\./, '').trim(); break; }
  }
  t = t.replace(/^(de |d'|d’|des |du )/i, '').replace(/\(.*?\)/g, '').split(/,| pour /)[0].trim();
  return { name: t || clean(raw), qty, unit, aisle: '' };
}

function steps(ins) {
  if (!ins) return [];
  if (typeof ins === 'string') return clean(ins).split(/(?<=\.)\s+(?=[A-ZÉÈÀ])/).filter(Boolean);
  if (Array.isArray(ins)) return ins.flatMap(x => typeof x === 'string' ? [clean(x)] : x.itemListElement ? steps(x.itemListElement) : [clean(x.text || x.name)]).filter(Boolean);
  return steps(ins.itemListElement || ins.text);
}
function servings(y) {
  const v = Array.isArray(y) ? y.find(x => /\d/.test(String(x))) : y;
  const n = parseInt(String(v ?? '').match(/\d+/)?.[0] || '', 10);
  return n > 0 && n < 50 ? n : 4;
}

export async function importFromUrl(url) {
  if (!/^https?:\/\/\S+\.\S+/.test(url.trim())) throw new Error('Lien invalide');
  const sb = Y.client();
  if (!sb || !Y.status.user) throw new Error('Connecte-toi d’abord (Réglages > Partage du foyer)');
  if (!navigator.onLine) throw new Error('Pas de réseau');
  const { data, error } = await sb.functions.invoke('import-recipe', { body: { url: url.trim() } });
  if (error) {
    let msg = ''; try { msg = (await error.context.json()).error; } catch {}
    throw new Error(msg || 'Import impossible (relais indisponible)');
  }
  const ingredients = (data.recipeIngredient || []).map(parseFr).filter(i => i.name);
  if (!data.name || !ingredients.length) throw new Error('Recette illisible sur cette page');
  return { title: clean(data.name), servings: servings(data.recipeYield), ingredients, steps: steps(data.recipeInstructions), source: url.trim() };
}
export { parseIngredient };
