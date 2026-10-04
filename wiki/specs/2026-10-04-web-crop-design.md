# Web — Rogner un PDF

_Rédigé le 4 octobre 2026. Demandé le 4 octobre, après la comparaison avec iLovePDF. Le Mac n'a pas cet outil._

Frère Cadreur (`/fr/rogner-pdf`, `/en/crop-pdf`) garde la zone choisie d'une page, ou de toutes, et enregistre la copie.

## Objectif

La spec est réussie quand :

- on trace sur la page affichée la zone à garder, puis on la déplace ou la redimensionne par ses poignées ;
- la zone s'applique à toutes les pages, ou à la page affichée seulement ;
- la copie montre exactement la zone tracée, page pivotée comprise ;
- rien d'autre ne change dans le fichier.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Moteur | `engine/crop.ts` règle la CropBox de chaque page visée (`FPDFPage_SetCropBox`) sur la zone, convertie des axes de la page telle que le lecteur la voit (`pageFrame`) vers ceux du fichier | C'est le cadre que les lecteurs affichent et impriment. Une page déjà rognée se rogne dans son cadre visible |
| Contenu hors zone | Il reste dans le fichier, invisible. Les pages et la FAQ le disent, et renvoient à Noircir pour le retirer | Retirer le contenu demanderait de redessiner la page en image, comme Noircir |
| Zone | En fractions de la page affichée, depuis son coin haut gauche. Sur toutes les pages, la même fraction de chaque page | Des pages de tailles différentes perdent la même part de leurs marges |
| Tracé | Tirer sur la page, hors de la zone, trace une zone neuve ; tirer dans la zone la déplace ; huit poignées la redimensionnent. 2 % de la page au moins dans chaque sens, avec une tolérance d'arrondi côté moteur. Sous 64 px à l'écran, la zone ne garde que ses quatre coins, sans zone de toucher élargie | Comme iLovePDF. Une poignée poussée au minimum donnait 0,019999… et le moteur refusait la zone. Une petite zone couverte de poignées ne se déplaçait plus |
| Départ | La zone laisse 5 % de marge de chaque côté | On voit tout de suite le cadre et ses poignées |
| Pages | « Toutes les pages » (par défaut) ou « Page N seulement » | Comme iLovePDF |
| Taille | Le panneau affiche la taille de la page rognée en millimètres | On sait ce qu'on obtient avant d'enregistrer |
| PDF signé | Refusé (`alreadySigned`) | Toute réécriture invalide la signature |
| PDF protégé | Ouvert avec son mot de passe ; la copie le garde | Comme Signets et Modifier |
| Moine | « Frère Cadreur » (« Brother Framer »), le cadre, en joie, catégorie Modifier | Cadrer, c'est choisir ce que l'on garde |

## Limites connues

- Pas de rognage automatique sur le contenu.
- Une seule zone par enregistrement : pour rogner deux pages différemment, enregistrer deux fois.
- Le contenu hors zone se retrouve si l'on agrandit à nouveau le cadre dans un autre logiciel.

## Tests

- Moteur (`tests/engine/crop.test.ts`) : cadre relu par pdf.js sur toutes les pages ou sur une seule ; page pivotée de 90° et de 270° ; page déjà rognée ; la marque laissée dans la zone reste à la même place relative ; zone poussée au minimum par une poignée acceptée ; zone impossible refusée ; PDF signé refusé, PDF protégé qui le reste.
- Modèle (`tests/unit/cropBox.test.ts`) : zone tracée dans les deux sens, déplacée sans sortir de la page, redimensionnée par chaque poignée, taille minimale.
- Navigateur (`tests/e2e/crop.spec.ts`) : zone tracée, toutes les pages ou une seule, copie relue. La taille affichée peut varier d'un millimètre selon le navigateur : le test l'accepte.
