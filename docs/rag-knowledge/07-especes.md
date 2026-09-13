# Espèces, souches et référentiels

## Multi-espèces (8)

Poulet (chair / pondeuse), **pintade, dinde, caille, canard, oie, faisan** et
volaille locale. L'application est ensuite multi-espèces : chaque lot déclare
son `species` et son `type` (`PONDEUSE` / `CHAIR`).

## 33 races référencées à l'installation

- **Chair** : Cobb 500, Ross 308, Ross 708, Hubbard, Arbor Acres, Sasso T451.
- **Pondeuse** : ISA Brown, Lohmann Brown, Hy-Line Brown, Novogen Brown,
  Bovans Brown, Shaver Brown.
- Plus Pintade, Dinde, Caille, Canard, Oie, Faisan et Volaille Locale (avec
  courbes par souche). Races personnalisées possibles via `POST /breeds`.

Chaque souche embarque ses **courbes zootechniques de référence** :
- chair → poids hebdomadaire + **IC** (Indice de Consommation) ;
- pondeuse → **taux de ponte hebdomadaire**.

L'écran « Saisie du jour » s'appuie sur la courbe de la souche pour :
- l'objectif de poids de la semaine (`targetAvgWeightKg`) ;
- l'objectif de taux de ponte de la semaine (`targetLayRatePercent`).

## Poids jour 1 par espèce

Le GMQ est normalisé par un poids jour 1 (`day1WeightKg`) propre à l'espèce.

Ordres de grandeur (repères) :
- poulet de chair ~40 g · pintadeau ~28 g · caille ~8 g.
- Une pondeuse démarre la ponte vers 18 semaines (pic ~24–28 semaines).

## Phases d'aliment par type

- **Pondeuse** : POUSSIN → DEMARRAGE → CROISSANCE → PRE_PONTE → PONTE_1/2/3.
- **Chair** : POUSSIN → DEMARRAGE → CROISSANCE → FINITION.
- Seuils d'âge : voir `02-alimentation.md` (pondeuse ≤ J10/J24/J112/J126 ;
  chair ≤ J10/J24/J35).

## Programme de vaccination (Gabon)

- Programmes pré-chargés `vacc-*` **spécifiques par espèce ET type** : jamais
  de programme POULET sur un lot non-POULET (rejet 400).
- L'assistant mobile pose la question par espèce/type unique : une sélection
  multi-espèces désactive le mode programme.

## Volaille locale

- Souche rustique : performance moindre mais résistance au climat. Les alertes
  seuils (densité, mortalité, poids) restent les mêmes, à interpréter avec les
  courbes de la souche locale (moins exigeantes).