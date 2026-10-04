# Web — Superposer deux PDF

_Rédigé et livré le 3 octobre 2026. Suit [Superposer sur Mac](2026-10-02-mac-overlay-design.md) : mêmes règles de pages, de position et de taille._

Frère Calque (`/fr/superposer-pdf`, `/en/overlay-pdf`) pose les pages d'un PDF sur celles d'un ou plusieurs autres : un papier à en-tête sous une lettre, une mention sur tout un dossier.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Moteur | `engine/overlay.ts` : chaque page du PDF posé devient un XObject de formulaire (`FPDF_NewXObjectFromPage`), posé par-dessus le contenu de la page ou sous lui (`FPDFPage_InsertObjectAtIndex(…, 0)`) | Les deux textes restent du texte ; un XObject sert autant de pages qu'il faut, l'en-tête répété est stocké une fois |
| Pages | Page pour page ; la dernière page du PDF posé va sur toutes les pages qui restent | Comme sur Mac |
| Taille | Ajustée à la page telle que le lecteur la voit et centrée, sans déformation | Comme sur Mac. Sonde du 3 octobre : le XObject de PDFium montre déjà la page posée telle que le lecteur la voit (rotation dans sa `/Matrix`, cadre ramené à l'origine) ; il suffit d'ajuster sa taille affichée |
| PDF qui reçoit | Signé, il est refusé (`alreadySigned`) | Toute réécriture invalide la signature |
| PDF posé | Lu seulement : signé, il est accepté ; protégé, il est refusé avec la marche à suivre (Frère Passe-partout) ; il reste choisi d'un document au suivant | Comme sur Mac |
| Plusieurs PDF | Le site accepte plusieurs PDF qui reçoivent : le même PDF est posé sur chacun | Un en-tête sert plusieurs lettres |
| Aperçu | Pas d'aperçu avant ; « Voir » sur le résultat, comme les autres outils de fichiers | L'espace de travail du site pour plusieurs PDF n'a pas de page affichée |
| Moine | « Frère Calque » (« Brother Layer »), le tampon, en joie | Le nom du Mac |

## Limites connues

- Pas de réglage de taille, de place ni d'opacité, et pas de choix des pages.
- Les annotations, les champs et les liens du PDF posé ne suivent pas : seul son dessin est posé.
- Dessous, il reste caché partout où la page peint un fond, même blanc (un scan).
- Une page posée recadrée montre aussi ce qui dépasse de son cadre : le XObject de PDFium garde toute la page.

## Tests

- Moteur (`tests/engine/overlay.test.ts`) : page pour page et dernière page répétée, les deux textes gardés ; dessus couvre, dessous laisse voir la page ; ajusté et centré, page posée pivotée, page qui reçoit pivotée ; PDF qui reçoit signé refusé, PDF posé signé accepté.
- Navigateur (`tests/e2e/overlay.spec.ts`) : en-tête posé sous une lettre de deux pages, textes gardés ; PDF posé protégé refusé avec son message.
