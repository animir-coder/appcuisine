import { norm } from './store.js';
export const AISLES = ['Fruits & légumes', 'Boulangerie', 'Boucherie & poisson', 'Crèmerie & frais', 'Épicerie salée', 'Épicerie sucrée', 'Conserves & sauces', 'Surgelés', 'Boissons', 'Hygiène & maison', 'Autre'];
// Rayons "frais" => date de péremption par défaut (jours)
export const FRESH_DAYS = { 'Fruits & légumes': 6, 'Boulangerie': 2, 'Boucherie & poisson': 3, 'Crèmerie & frais': 8 };
export const LOCS = { frigo: 'Frigo', placard: 'Placard', congelo: 'Congélo' };
export const LEVELS = ['plein', 'entame', 'presque'];
export const LEVEL_LABEL = { plein: 'Plein', entame: 'Entamé', presque: 'Presque fini' };
export const UNITS = ['g', 'kg', 'ml', 'cl', 'l', 'pièce', 'c. à s.', 'c. à c.', 'tranche', 'boîte', 'sachet', 'botte', 'gousse', 'pincée'];

// Petit dictionnaire pour deviner le rayon sans rien saisir (normalisé à l'indexation)
const GUESS = {
  'Conserves & sauces': 'sauce tomate,concentre de tomate,coulis,thon en boite,maïs,lait de coco,ketchup,mayonnaise,pesto,sauce soja,pois chiches,haricots rouges',
  'Surgelés': 'surgele,glace,petits pois,frite',
  'Crèmerie & frais': 'lait,beurre,creme,oeuf,fromage,gruyere,emmental,parmesan,mozzarella,feta,chevre,yaourt,mascarpone,ricotta,comte,pate feuilletee,pate brisee,pate a pizza',
  'Fruits & légumes': 'tomate,oignon,ail,echalote,carotte,courgette,aubergine,poivron,salade,pomme de terre,patate,poireau,champignon,citron,pomme,banane,orange,poire,avocat,concombre,epinard,brocoli,chou,haricot vert,persil,basilic,coriandre,ciboulette,menthe,thym,gingembre,fraise,courge,potiron,butternut,navet,radis,celeri,fenouil,kiwi,raisin,mangue',
  'Boulangerie': 'pain,baguette,brioche',
  'Boucherie & poisson': 'poulet,boeuf,steak,hache,porc,veau,agneau,dinde,lardon,jambon,saucisse,chorizo,saumon,cabillaud,crevette,poisson,canard,colin,merlu,cabillaud',
  'Épicerie salée': 'pate,riz,farine,huile,vinaigre,sel,poivre,semoule,quinoa,lentille,bouillon,epice,curry,paprika,cumin,moutarde,chapelure,olive,lasagne,tortilla,herbes de provence,muscade,cannelle,piment,aneth,epices fajitas,riz arborio',
  'Épicerie sucrée': 'sucre,chocolat,miel,confiture,cafe,the,cereale,levure,vanille,biscuit,cacao',
  'Boissons': 'eau,jus,vin,biere,soda',
  'Hygiène & maison': 'papier,essuie tout,liquide vaisselle,eponge,lessive,savon,dentifrice,sac poubelle',
};
// expressions les plus longues d'abord : "lait de coco" avant "lait", "pomme de terre" avant "pomme"
const GUESS_IDX = Object.entries(GUESS).flatMap(([a, s]) => s.split(',').map(p => [norm(p), a])).sort((x, y) => y[0].length - x[0].length);
export function guessAisle(n) {
  const padded = ' ' + n + ' ';
  for (const [p, a] of GUESS_IDX) if (padded.includes(' ' + p + ' ')) return a;
  return 'Autre';
}

export const DEMO = [
  { title: 'Pâtes carbonara', servings: 4, ingredients: [['pâtes', 400, 'g', 'Épicerie salée'], ['lardons', 200, 'g', 'Boucherie & poisson'], ['œufs', 4, 'pièce', 'Crèmerie & frais'], ['parmesan', 80, 'g', 'Crèmerie & frais'], ['poivre', '', '', 'Épicerie salée']], steps: ['Cuire les pâtes.', 'Faire revenir les lardons.', 'Mélanger œufs et parmesan.', 'Mélanger le tout hors du feu, poivrer.'] },
  { title: 'Curry de pois chiches', servings: 4, ingredients: [['pois chiches', 2, 'boîte', 'Conserves & sauces'], ['lait de coco', 400, 'ml', 'Conserves & sauces'], ['oignon', 1, 'pièce', 'Fruits & légumes'], ['curry', 2, 'c. à s.', 'Épicerie salée'], ['riz', 300, 'g', 'Épicerie salée'], ['épinards', 200, 'g', 'Fruits & légumes']], steps: ['Faire revenir l’oignon avec le curry.', 'Ajouter pois chiches et lait de coco, mijoter 15 min.', 'Ajouter les épinards. Servir avec le riz.'] },
  { title: 'Omelette aux champignons', servings: 2, ingredients: [['œufs', 6, 'pièce', 'Crèmerie & frais'], ['champignons', 250, 'g', 'Fruits & légumes'], ['beurre', 20, 'g', 'Crèmerie & frais'], ['ciboulette', '', '', 'Fruits & légumes']], steps: ['Poêler les champignons au beurre.', 'Battre les œufs, verser, cuire.', 'Parsemer de ciboulette.'] },
  { title: 'Saumon riz brocoli', servings: 2, ingredients: [['saumon', 2, 'pièce', 'Boucherie & poisson'], ['riz', 150, 'g', 'Épicerie salée'], ['brocoli', 1, 'pièce', 'Fruits & légumes'], ['citron', 1, 'pièce', 'Fruits & légumes']], steps: ['Cuire le riz.', 'Cuire le brocoli à la vapeur.', 'Cuire le saumon à la poêle, arroser de citron.'] },
];
export const DEMO_STOCK = [['pâtes', 'placard', 'entame'], ['riz', 'placard', 'plein'], ['poivre', 'placard', 'plein'], ['curry', 'placard', 'presque'], ['œufs', 'frigo', 'plein', 3], ['beurre', 'frigo', 'entame', 12], ['parmesan', 'frigo', 'entame', 1], ['épinards', 'congelo', 'plein']];
export const DEMO_RECURRENTS = [['lait', 'Crèmerie & frais'], ['pain', 'Boulangerie'], ['papier toilette', 'Hygiène & maison']];
