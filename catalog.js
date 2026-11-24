// Catalogue de recettes du quotidien, quantités pour 2 personnes.
// Format ingrédient : "nom quantité unité" (quantité et unité facultatives), séparés par ";".
// Le rayon est deviné à partir du nom (data.js), sauf précision "nom @Rayon".
export const CATEGORIES = ['Pâtes & riz', 'Viandes', 'Poissons', 'Végétarien', 'Soupes', 'Salades', 'Plats mijotés', 'Desserts'];

const R = (c, t, i, s, m) => ({ c, t, p: 2, i, s, m });
export const CATALOG = [
  // Pâtes & riz
  R('Pâtes & riz', 'Pâtes carbonara', 'pâtes 200 g; lardons 100 g; œufs 2; parmesan 40 g; poivre', 'Cuire les pâtes.|Faire dorer les lardons.|Battre œufs et parmesan.|Mélanger hors du feu avec un peu d’eau de cuisson, poivrer.', 20),
  R('Pâtes & riz', 'Pâtes bolognaise', 'pâtes 200 g; bœuf haché 200 g; oignon 1; ail 1 gousse; sauce tomate 300 g; huile d’olive; parmesan 30 g', 'Faire revenir oignon et ail.|Ajouter la viande, puis la sauce tomate, mijoter 20 min.|Servir sur les pâtes avec le parmesan.', 35),
  R('Pâtes & riz', 'Pâtes au pesto et tomates cerises', 'pâtes 200 g; pesto 60 g; tomates cerises 200 g; parmesan 30 g', 'Cuire les pâtes.|Couper les tomates en deux.|Mélanger pâtes, pesto et tomates, parsemer de parmesan.', 15),
  R('Pâtes & riz', 'Penne saumon crème', 'pâtes 200 g; saumon fumé 100 g; crème fraîche 15 cl; citron 1; aneth', 'Cuire les pâtes.|Chauffer la crème avec un filet de citron.|Ajouter le saumon en lanières et l’aneth, mélanger aux pâtes.', 20),
  R('Pâtes & riz', 'Risotto aux champignons', 'riz arborio 160 g; champignons 250 g; échalote 1; bouillon de volaille 1 cube; vin blanc 5 cl; parmesan 40 g; beurre 20 g', 'Faire revenir échalote et champignons au beurre.|Nacrer le riz, déglacer au vin blanc.|Ajouter le bouillon louche par louche pendant 18 min.|Finir avec le parmesan.', 35),
  R('Pâtes & riz', 'Riz cantonais', 'riz 150 g; jambon 2 tranche; œufs 2; petits pois 100 g; oignon 1; sauce soja 2 c. à s.; huile', 'Cuire le riz la veille si possible.|Faire une omelette fine, la couper en lanières.|Sauter oignon, petits pois, jambon puis riz.|Ajouter omelette et sauce soja.', 25),
  R('Pâtes & riz', 'Lasagnes', 'feuilles de lasagne 8; bœuf haché 250 g; sauce tomate 400 g; oignon 1; lait 40 cl; beurre 30 g; farine 30 g; gruyère râpé 60 g', 'Faire la bolognaise (oignon, viande, sauce tomate).|Faire une béchamel (beurre, farine, lait).|Alterner pâtes, bolognaise, béchamel.|Gratiner 35 min à 180 °C.', 70),
  // Viandes
  R('Viandes', 'Poulet curry coco', 'blancs de poulet 2; lait de coco 20 cl; oignon 1; curry 1 c. à s.; riz 150 g', 'Faire revenir oignon et curry.|Ajouter le poulet en morceaux, dorer.|Verser le lait de coco, mijoter 15 min.|Servir avec le riz.', 30),
  R('Viandes', 'Poulet rôti et pommes de terre', 'cuisses de poulet 2; pommes de terre 500 g; ail 3 gousse; thym; huile d’olive', 'Couper les pommes de terre.|Disposer avec le poulet, l’ail et le thym, arroser d’huile.|Cuire 45 min à 200 °C.', 55),
  R('Viandes', 'Steak haché frites maison', 'steaks hachés 2; pommes de terre 500 g; huile; salade 1', 'Couper les frites, cuire au four 35 min à 220 °C avec un filet d’huile.|Cuire les steaks à la poêle.|Servir avec la salade.', 40),
  R('Viandes', 'Chili con carne', 'bœuf haché 250 g; haricots rouges 1 boîte; tomates concassées 1 boîte; oignon 1; poivron 1; cumin 1 c. à c.; piment; riz 150 g', 'Faire revenir oignon et poivron.|Ajouter la viande et les épices.|Ajouter tomates et haricots, mijoter 30 min.|Servir avec le riz.', 45),
  R('Viandes', 'Escalopes de dinde à la crème', 'escalopes de dinde 2; champignons 200 g; crème fraîche 15 cl; échalote 1; riz 150 g', 'Dorer les escalopes, réserver.|Faire revenir échalote et champignons.|Ajouter la crème et les escalopes, mijoter 5 min.|Servir avec le riz.', 25),
  R('Viandes', 'Saucisses lentilles', 'saucisses 4; lentilles 150 g; carotte 2; oignon 1; bouillon 1 cube', 'Faire revenir oignon et carottes.|Ajouter lentilles et bouillon, cuire 25 min.|Dorer les saucisses et les ajouter 10 min avant la fin.', 40),
  R('Viandes', 'Croque-monsieur', 'pain de mie 4 tranche; jambon 2 tranche; gruyère râpé 60 g; beurre 20 g; salade 1', 'Beurrer le pain, garnir de jambon et fromage.|Cuire 10 min au four à 200 °C ou à la poêle.|Servir avec la salade.', 15),
  R('Viandes', 'Fajitas au poulet', 'blancs de poulet 2; tortillas 4; poivron 2; oignon 1; épices fajitas 1 sachet; crème fraîche 10 cl', 'Émincer poulet, poivrons et oignon.|Sauter avec les épices.|Garnir les tortillas, ajouter la crème.', 25),
  // Poissons
  R('Poissons', 'Saumon riz brocoli', 'pavés de saumon 2; riz 150 g; brocoli 1; citron 1', 'Cuire le riz et le brocoli à la vapeur.|Cuire le saumon à la poêle côté peau.|Arroser de citron.', 25),
  R('Poissons', 'Cabillaud en papillote', 'dos de cabillaud 2; courgette 1; tomates 2; citron 1; huile d’olive; herbes de Provence', 'Couper les légumes en rondelles.|Disposer poisson et légumes sur du papier cuisson, arroser d’huile et de citron.|Fermer et cuire 20 min à 200 °C.', 30),
  R('Poissons', 'Gratin de poisson', 'filets de colin 300 g; pommes de terre 400 g; crème fraîche 20 cl; gruyère râpé 50 g', 'Cuire les pommes de terre en rondelles 10 min.|Disposer poisson et pommes de terre, napper de crème, parsemer de fromage.|Cuire 25 min à 200 °C.', 45),
  R('Poissons', 'Crevettes sautées ail et persil', 'crevettes 300 g; ail 2 gousse; persil; beurre 20 g; riz 150 g', 'Cuire le riz.|Sauter les crevettes au beurre avec ail et persil 4 min.|Servir aussitôt.', 20),
  R('Poissons', 'Thon à la tomate', 'thon en boîte 1 boîte; tomates concassées 1 boîte; oignon 1; olives 50 g; pâtes 200 g', 'Faire revenir l’oignon.|Ajouter tomates et olives, mijoter 10 min.|Ajouter le thon émietté, servir avec les pâtes.', 20),
  // Végétarien
  R('Végétarien', 'Curry de pois chiches', 'pois chiches 1 boîte; lait de coco 20 cl; oignon 1; curry 1 c. à s.; épinards 150 g; riz 150 g', 'Faire revenir oignon et curry.|Ajouter pois chiches et lait de coco, mijoter 15 min.|Ajouter les épinards, servir avec le riz.', 25),
  R('Végétarien', 'Omelette aux champignons', 'œufs 4; champignons 200 g; beurre 15 g; ciboulette', 'Poêler les champignons au beurre.|Battre les œufs, verser, cuire.|Parsemer de ciboulette.', 15),
  R('Végétarien', 'Quiche lorraine végé (poireaux)', 'pâte brisée 1; poireaux 2; œufs 3; crème fraîche 20 cl; gruyère râpé 60 g', 'Faire fondre les poireaux émincés.|Battre œufs et crème, ajouter poireaux et fromage.|Verser sur la pâte, cuire 35 min à 180 °C.', 50),
  R('Végétarien', 'Gratin de courgettes', 'courgettes 3; œufs 2; crème fraîche 15 cl; gruyère râpé 60 g; ail 1 gousse', 'Couper et poêler les courgettes avec l’ail.|Mélanger œufs, crème et fromage.|Verser sur les courgettes, cuire 25 min à 200 °C.', 40),
  R('Végétarien', 'Dahl de lentilles corail', 'lentilles corail 150 g; lait de coco 20 cl; tomates concassées 1 boîte; oignon 1; gingembre; curry 1 c. à s.; riz 150 g', 'Faire revenir oignon, gingembre et curry.|Ajouter lentilles, tomates, lait de coco et 30 cl d’eau.|Cuire 20 min, servir avec le riz.', 30),
  R('Végétarien', 'Pizza maison margherita', 'pâte à pizza 1; sauce tomate 150 g; mozzarella 125 g; basilic', 'Étaler la pâte, couvrir de sauce.|Ajouter la mozzarella.|Cuire 12 min à 250 °C, ajouter le basilic.', 25),
  R('Végétarien', 'Œufs cocotte épinards', 'œufs 4; épinards 150 g; crème fraîche 10 cl; pain 1', 'Répartir épinards et crème dans des ramequins.|Casser un œuf par-dessus.|Cuire 12 min à 180 °C au bain-marie.', 20),
  R('Végétarien', 'Shakshuka', 'œufs 4; tomates concassées 1 boîte; poivron 1; oignon 1; cumin 1 c. à c.; pain 1', 'Faire revenir oignon et poivron.|Ajouter tomates et cumin, mijoter 10 min.|Casser les œufs dedans, couvrir 6 min.', 25),
  // Soupes
  R('Soupes', 'Velouté de potiron', 'potiron 600 g; pomme de terre 1; oignon 1; crème fraîche 10 cl; bouillon 1 cube', 'Couper les légumes, cuire 25 min dans le bouillon.|Mixer avec la crème.', 35),
  R('Soupes', 'Soupe de légumes', 'carottes 2; poireau 1; pommes de terre 2; navet 1; bouillon 1 cube', 'Couper les légumes.|Cuire 30 min dans 1 l de bouillon.|Mixer ou laisser en morceaux.', 40),
  R('Soupes', 'Soupe à l’oignon', 'oignons 4; beurre 30 g; farine 1 c. à s.; bouillon 1 cube; pain 1; gruyère râpé 60 g', 'Faire fondre les oignons au beurre 20 min.|Saupoudrer de farine, mouiller au bouillon, cuire 20 min.|Servir avec pain grillé et fromage gratiné.', 50),
  R('Soupes', 'Velouté de brocoli', 'brocoli 1; pomme de terre 1; crème fraîche 10 cl; bouillon 1 cube', 'Cuire brocoli et pomme de terre 20 min dans le bouillon.|Mixer avec la crème.', 25),
  // Salades
  R('Salades', 'Salade niçoise', 'thon en boîte 1 boîte; œufs 2; tomates 2; haricots verts 150 g; olives 40 g; salade 1; huile d’olive', 'Cuire œufs durs et haricots.|Disposer tous les ingrédients sur la salade.|Assaisonner.', 20),
  R('Salades', 'Salade César', 'blancs de poulet 2; salade romaine 1; parmesan 30 g; pain 1; mayonnaise 2 c. à s.; citron 1', 'Griller le poulet, faire des croûtons.|Mélanger mayonnaise, citron et parmesan.|Assembler.', 25),
  R('Salades', 'Taboulé', 'semoule 150 g; tomates 2; concombre 1; menthe; persil; citron 1; huile d’olive', 'Gonfler la semoule à l’eau chaude.|Couper les légumes, ciseler les herbes.|Mélanger avec citron et huile, réserver au frais.', 20),
  R('Salades', 'Salade de pâtes', 'pâtes 150 g; tomates cerises 150 g; mozzarella 125 g; jambon 2 tranche; pesto 2 c. à s.', 'Cuire et refroidir les pâtes.|Ajouter le reste coupé en dés.|Mélanger avec le pesto.', 20),
  // Plats mijotés
  R('Plats mijotés', 'Blanquette de veau', 'veau 400 g; carottes 2; champignons 150 g; oignon 1; crème fraîche 15 cl; bouillon 1 cube; riz 150 g', 'Couvrir la viande de bouillon avec carottes et oignon, cuire 1 h 15.|Ajouter les champignons 15 min.|Lier avec la crème, servir avec le riz.', 100),
  R('Plats mijotés', 'Bœuf bourguignon', 'bœuf à braiser 400 g; vin rouge 40 cl; carottes 2; lardons 80 g; champignons 150 g; oignon 1; farine 1 c. à s.', 'Dorer la viande et les lardons.|Ajouter oignon, carottes, farine, puis le vin.|Mijoter 2 h 30, ajouter les champignons à la fin.', 180),
  R('Plats mijotés', 'Hachis parmentier', 'bœuf haché 300 g; pommes de terre 600 g; lait 15 cl; beurre 30 g; oignon 1; gruyère râpé 40 g', 'Faire une purée.|Faire revenir oignon et viande.|Alterner viande et purée, parsemer de fromage, gratiner 20 min.', 60),
  R('Plats mijotés', 'Ratatouille', 'courgette 1; aubergine 1; poivron 1; tomates 3; oignon 1; ail 2 gousse; huile d’olive; herbes de Provence', 'Couper tous les légumes.|Les faire revenir séparément puis réunir.|Mijoter 40 min à feu doux.', 60),
  R('Plats mijotés', 'Gratin dauphinois', 'pommes de terre 600 g; crème fraîche 20 cl; lait 20 cl; ail 1 gousse; muscade', 'Trancher finement les pommes de terre.|Disposer dans un plat frotté d’ail, couvrir de lait et crème.|Cuire 1 h à 170 °C.', 75),
  // Desserts
  R('Desserts', 'Crêpes', 'farine 125 g; œufs 2; lait 25 cl; beurre 20 g; sucre 1 c. à s.', 'Mélanger farine, sucre et œufs.|Ajouter le lait peu à peu, puis le beurre fondu.|Cuire à la poêle.', 30),
  R('Desserts', 'Gâteau au chocolat', 'chocolat noir 100 g; beurre 80 g; sucre 60 g; œufs 2; farine 30 g', 'Fondre chocolat et beurre.|Ajouter sucre, œufs puis farine.|Cuire 20 min à 180 °C.', 35),
  R('Desserts', 'Compote de pommes', 'pommes 4; sucre 1 c. à s.; cannelle', 'Éplucher et couper les pommes.|Cuire 20 min à couvert avec un peu d’eau, le sucre et la cannelle.|Écraser.', 25),
  R('Desserts', 'Mousse au chocolat', 'chocolat noir 100 g; œufs 3; sucre 1 c. à s.', 'Fondre le chocolat, ajouter les jaunes.|Monter les blancs avec le sucre.|Incorporer, réserver 3 h au frais.', 20),
];

export function parseIngredient(s) {
  let [txt, aisle] = s.split('@').map(x => x.trim());
  const m = txt.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*(.*)$/);
  return m ? { name: m[1], qty: m[2], unit: m[3], aisle } : { name: txt, qty: '', unit: '', aisle };
}
