# Poids — pesées et croissance

## Protocole de pesée (affiché dans l'écran)

- Échantillon : **au moins 30 sujets représentatifs** (prélever dans toutes les
  zones du bâtiment, pas seulement au point d'eau).
- Périodicité : **une fois par semaine**, le **même jour et à la même heure**
  (idéalement avant distribution de l'aliment) pour limiter la variabilité
  (heure, satiété).
- Saisie en **g / oiseau** (`weightG`), stockée en kg côté serveur
  (`avgWeightKg`).

## Objectif souche

- Les souches des 33 races (cuisinées) embarquent des **courbes zootechniques
  de référence** : poids par semaine (+ IC pour chair, taux de ponte pour
  pondeuse).
- L'écran affiche l'objectif de la semaine du lot (ex. « S8 : 1,34 kg ») via le
  référentiel `breed-standards` (semaine exacte ou dernière semaine ≤ au lot).
- Écart : **|−10 %| = dans la courbe**, jusqu'à **20 % = écart notable**,
  **> 20 % (négatif) = retard important** → vérifier alimentation et santé.

## Delta vs dernière pesée

- Comparaison à la **dernière pesée enregistrée** (7 jours glissants utilisés
  pour la référence). Un gain régulier est attendu (j > 0) ; une **perte de
  poids = à surveiller** (eau, aliment, parasitisme, chaleur).

## GMQ — Gain Moyen Quotidien

- `GMQ = (poids − poids jour 1 de l'espèce) / âge en jours`.
- Évalué à partir de 2 pesées consécutives (dès J14 d'âge) ; le lot est sa
  propre référence.
- Baisse **>= 10 %** vs la pesée précédente (`GMQ_DEVIATION_WARN_PCT`) →
  alerte JAUNE « croissance ralentie » : qualité de l'aliment, ambiance
  (chauffage/ventilation), santé, et re-poser une pesée de contrôle.

## Remarques espèces

- Poids jour 1 (`day1WeightKg`) propre à chaque espèce : un poussin de chair
  (~40 g) pèse plus lourd qu'une caille (~8 g) ou qu'un pintadeau (~28 g).
  Le GMQ est donc toujours normalisé par le poids jour 1 de l'espèce.