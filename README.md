# Cuisine du foyer – MVP (PWA)

HTML/CSS/JS sans build, installable, fonctionne hors ligne. Données locales (localStorage) pour l’instant.

## Lancer
```
cd app-cuisine && python3 -m http.server 8000   # puis http://localhost:8000
```
Réglages ⚙ > « Exemples » pour charger 4 recettes + un stock de démo.

## Écrans
| Onglet | Ce qu’on y fait |
|---|---|
| Recettes | Cocher les recettes à faire, « Préparer la liste », créer/modifier (rayon deviné automatiquement) |
| Vérifier la liste | Candidats = ingrédients manquants + récurrents + stock « presque fini ». Décocher puis valider |
| Courses | Triée par rayon, ajout manuel, ⟳ = récurrent. Cocher = ajouté au stock (décocher = annulé) |
| Stock | Frigo/Placard/Congélo, niveau en 1 tap, péremption auto pour le frais, alerte « à consommer vite » |
| Cuisiner | Ce que je peux faire avec mon stock : faisables / manque 1 / manque 2, bouton « ajouter les manquants » |
| Catalogue | 45 recettes pour 2, recherche par nom ou ingrédient, lien Marmiton, import par lien ou partage (Android) |

## Portions
Taille du foyer dans Réglages (2 par défaut, réglage propre à chaque téléphone). Chaque recette a un sélecteur – N + qui recalcule quantités affichées et liste de courses.

## Import par lien
Relais Supabase `supabase/functions/import-recipe` : lit les données schema.org/Recipe de la page. Nécessite d'être connecté.

## Hypothèses prises
- Correspondance des ingrédients par nom (pluriels et accents ignorés). Pas de calcul de quantités : le stock est approximatif.
- « Presque fini » = considéré en stock pour cuisiner, mais proposé à l’achat.
- Cuisiner : frais et congelé retirés du stock, placard baisse d’un cran. Annulable 5 s.
- Péremption par défaut : boucherie 3 j, crèmerie 8 j, fruits & légumes 6 j, pain 2 j (modifiable).
- L’app apprend : rayon et emplacement choisis une fois sont réutilisés.

## Partage foyer (Supabase)
Local d'abord : tout marche hors ligne, les modifs partent dès que le réseau revient, celles des autres arrivent en temps réel. Conflit = la dernière modification d'un élément gagne.

**Mise en place (une fois)**
1. supabase.com > New project (région Europe).
2. SQL Editor > New query > coller `supabase/schema.sql` > Run.
3. Authentication > Sign In / Providers > Email : désactiver **Confirm email** (connexion e-mail + mot de passe immédiate, sans e-mail à recevoir).
4. Project Settings > API : copier l'URL et la clé `anon` dans `config.js`.
5. Dans l'app : Réglages > Partage du foyer > e-mail + mot de passe > « Créer mon compte » > « Créer » (le 1er téléphone envoie ses données). Les autres : « Rejoindre » avec le code d'invitation.

| Fichier | Rôle |
|---|---|
| `store.js` | Données locales + détection des changements élément par élément + file d'attente |
| `sync.js` | Connexion, foyer, envoi / réception (temps réel + rattrapage au retour réseau) |
| `supabase/schema.sql` | Tables, sécurité (chacun ne voit que son foyer), fonctions créer / rejoindre |
| `vendor/supabase.js` | supabase-js 2.58.0 embarqué (marche hors ligne) |
