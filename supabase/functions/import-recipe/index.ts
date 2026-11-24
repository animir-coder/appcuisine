// Relais d'import : lit une page de recette (Marmiton, 750g, CuisineAZ…) et renvoie
// les données structurées schema.org/Recipe qu'elle publie. Réservé aux membres connectés.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
function findRecipe(o: any): any {
  if (!o || typeof o !== 'object') return null;
  if (Array.isArray(o)) { for (const x of o) { const f = findRecipe(x); if (f) return f; } return null; }
  const t = o['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return o;
  if (o['@graph']) return findRecipe(o['@graph']);
  if (o.mainEntity) return findRecipe(o.mainEntity);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { url } = await req.json();
    const u = new URL(url);
    const host = u.hostname;
    if (!['http:', 'https:'].includes(u.protocol) || !host.includes('.') || /^(localhost|\d+(\.\d+){3}|\[)/.test(host) || host.endsWith('.internal') || host.endsWith('.local')) {
      return json({ error: 'Lien invalide' }, 400);
    }
    const r = await fetch(u, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CuisineFoyer/1.0)', 'Accept-Language': 'fr-FR,fr;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return json({ error: `Le site a répondu ${r.status}` }, 502);
    const html = (await r.text()).slice(0, 3_000_000);
    const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    for (const b of blocks) {
      try {
        const rec = findRecipe(JSON.parse(b.trim()));
        if (rec) {
          return json({
            name: rec.name,
            recipeYield: rec.recipeYield,
            recipeIngredient: rec.recipeIngredient || rec.ingredients || [],
            recipeInstructions: rec.recipeInstructions || [],
            totalTime: rec.totalTime,
          });
        }
      } catch { /* bloc JSON-LD invalide : on passe au suivant */ }
    }
    return json({ error: 'Aucune recette lisible sur cette page' }, 422);
  } catch {
    return json({ error: 'Import impossible' }, 500);
  }
});
