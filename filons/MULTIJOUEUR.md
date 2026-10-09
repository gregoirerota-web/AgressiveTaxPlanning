# FILONS — accès à distance (version expérimentale)

Le jeu classique est accessible à `/`. Le nouveau mode **multijoueur en ligne** est accessible à `/multiplayer.html`.

## Jouer à plusieurs depuis des lieux différents

1. Une personne joue le **ministre** et clique sur « En ligne — plusieurs joueurs à distance » puis « Créer une partie ».
2. Le jeu lui fournit un **code de salle** à 6 caractères.
3. Chaque firme ouvre **la même adresse Internet**, suit le lien « En ligne », indique son nom et le code.
4. Le ministre lance la partie. Les firmes déposent leurs offres en parallèle ; chacune ne voit que ses propres choix. Le serveur attend les choix transmis puis résout les offres.
5. Les phases suivantes sont : investissements simultanés, stratégies fiscales simultanées, contrôle du ministre, résultats publics. Le ministre lance le tour suivant.

Chaque joueur a besoin d'un ordinateur et d'une connexion Internet. Le jeu peut aussi fonctionner sur le réseau local.

## Version enrichie : fiscalité et partage de la rente

Après l'attribution, le plateau indique le **gisement découvert**, son exploitant et son équipement éventuel. Les concessions sans mine sont aussi visibles et ne produisent rien.

Au stade « Stratégies fiscales », chaque entreprise choisit **pour chacune de ses mines** trois montants distincts (M€) : achats intragroupe / prix de transfert, intérêts intragroupe et frais de siège. Les valeurs de référence (coût réel, zone sûre, plafond) sont affichées, ainsi que le bénéfice imposable et l'IS estimé *avant contrôle*. Les données détaillées ne sont transmises qu'à la firme concernée.

Le ministre ne voit que le chiffre d'affaires, les charges totales déclarées et leur écart au sommet des zones sûres. Il choisit un contrôle national parmi les trois canaux. Le bilan présente le **résultat par gisement et par firme**, la **rente économique**, les **redevances**, l'**impôt sur les sociétés**, les **pénalités**, les **profits économiques après prélèvements** et les parts de rente de l'État et des entreprises (si la rente est positive).

**Conventions de calcul :** rente = recettes de vente − dépenses réelles d'exploitation − amortissement ; profit économique = rente − prélèvements fiscaux ; recettes fiscales = redevances + IS + pénalités. Le prix des permis est une recette supplémentaire de l'État, mais n'entre pas dans la répartition de la rente d'exploitation du tour. Le rendement cumulé de chaque firme est le solde de trésorerie généré pendant la partie (y compris dépenses de permis et d'équipements) divisé par les investissements en équipements. Il s'agit d'un **indicateur pédagogique**, sans actualisation ni risque probabilisé.

La nouvelle déclaration détaille les trois canaux ; la mécanique demeure une simplification des règles de FILONS classique. Les contrôles restent déterministes, sans probabilité d'audit, et toutes les firmes attendent la clôture de la phase pour voir avancer le jeu.

## Déployer gratuitement sur Render

Le fichier `../render.yaml` définit un **Web Service Node.js**, plan `free`, dans le sous-répertoire `filons/`.

1. Ouvrir [Render](https://dashboard.render.com/) et connecter GitHub.
2. Choisir **New → Blueprint**, sélectionner `gregoirerota-web/AgressiveTaxPlanning` et la branche intégrant le code du mode multijoueur.
3. Vérifier que le Blueprint prévoit `filons-multijoueur`, plan **Free**, commandes `npm install --no-audit --no-fund && npm run build` et `npm start`.
4. Laisser Render créer le service et attendre que `/api/health` réponde `{"ok":true}`.
5. Communiquer aux joueurs le lien `https://<nom-attribué-par-render>.onrender.com/multiplayer.html`.

Ce lien est **un exemple de format**, pas une adresse de jeu déjà hébergée. Le déploiement réel nécessite l'autorisation et la connexion GitHub/Render de l'organisateur.

### Limites de la version gratuite et du prototype

- Render peut arrêter le service après 15 minutes sans trafic entrant ; le réveil peut prendre une minute.
- L'état des salles est **en mémoire serveur** : redémarrage, redéploiement ou extinction = parties perdues. Le jeton de reconnexion du navigateur ne remplace pas une sauvegarde permanente.
- Le code de salle facilite la connexion, mais **n'est pas une authentification forte** ; ne pas utiliser avec des données personnelles ou confidentielles réelles.
- Une seule instance serveur est prévue. Pas de synchronisation entre plusieurs serveurs ni de base persistante.
- Le mode en ligne est pour l'instant un **prototype stratégique simplifié**, distinct du moteur complet des règles FILONS classique : une firme peut proposer un bloc par tour, une adjudication compare les offres et les stratégies d'optimisation sont résumées en quatre intensités. Les 8 tours, les régimes IS/redevance, la production, les investissements et les contrôles restent représentés. Il faudra harmoniser les règles avant une formation avancée.
- Les règles des modes classiques (solo et hotseat) restent inchangées.

## Démarrer localement

```bash
cd filons
npm install
npm run build
npm start
```

Ouvrir `http://localhost:3001` pour le jeu classique ou `http://localhost:3001/multiplayer.html` pour le mode en ligne.

Le mode développeur React classique : `npm run dev`. Pour essayer le multijoueur en développement, lancer le serveur `npm start` séparément. Vite redirige `/socket.io` et `/api` vers le serveur sur le port 3001.

## Tests

```bash
npm run build
npm run test:server
npm run test:e2e
```

Le test serveur vérifie l'isolation des informations géologiques, le refus des actions hors rôle, les offres simultanées, les capacités d'accueil et le règlement d'un tour.
