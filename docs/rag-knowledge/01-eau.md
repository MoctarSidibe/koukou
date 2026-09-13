# Eau — l'indicateur n°1

## Pourquoi l'eau d'abord

Chez les volailles, une **baisse de consommation d'eau précède** presque
toujours les signes cliniques de maladie (les oiseaux cessent de boire avant de
cesser de manger). C'est le tout premier signal d'alerte à vérifier chaque jour.

Chute brutale de consommation d'eau (`kg equivalent` non, c'est en litres) :
- **Jaune (surveillance)** : baisse >= **10 %** vs moyenne mobile des
  3 derniers jours enregistrés (`WATER_DROP_WARN_PCT`).
- **Rouge (critique)** : baisse > **25 %** (`WATER_DROP_CRITICAL_PCT`).
  → Vérifier immédiatement abreuvement ET contacter le vétérinaire.

## Normalisation par oiseau

La consommation d'eau du jour se normalise par l'effectif **vivant estimé le
jour de la saisie** (effectif initial − morts cumulés jusqu'à cette date).

- Norme de référence : **0,2 L / oiseau / jour** (`WATER_PER_BIRD_L_DAY`), pour
  une pondeuse standard au pic.
- Un écart de ± **20 %** par rapport à la norme (`WATER_NORM_DEVIATION_WARN_PCT`)
  déclenche une vigilance : consommation anormalement basse **ou** élevée,
  pression des abreuvoirs, qualité de l'eau (température, propreté).

## Ratio eau / aliment

- Norme pratique : **1,8 à 2,6 litres d'eau pour 1 kg d'aliment**.
- Ratio < 1,8 : sous-consommation d'eau → risque d'arrêt de ponte / réduction
  de croissance. Vérifier abreuvoirs et température.
- Ratio > 2,6 : sur-consommation → eau chaude, fuite, litière humide,
  diarrhée. Vérifier fuites et litière.
- Calcul : `waterL / feedKgEquivalent` avec
  `feedKgEquivalent = feedKg` (mode kg) ou `feedSacs × 50` (mode sacs).

## Référence 7 jours

Dans l'écran « Saisie du jour », les moyennes comparatives (eau/oiseau, ratio)
sont calculées sur les **7 derniers jours enregistrés avant la date sélectionnée**
(et non avant aujourd'hui), pour comparer des périodes identiques.

## En résumé

1. Comparer l'eau d'aujourd'hui à la moyenne glissante (3 j) normalisée par
   oiseau : > 10 % de baisse = surveiller, > 25 % = urgence.
2. Un effondrement de l'eau s'accompagne souvent d'une mortalité en hausse
   quelques jours plus tard → alerte combinée **MALADIE**.
3. Ratio eau/aliment hors [1,8 – 2,6] : vérifier abreuvement/qualité avant de
   suspecter une maladie.