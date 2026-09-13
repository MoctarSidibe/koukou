# Mortalité — seuils et tendance

## Repères

- **0,5 % / jour** est un taux courant en zone humide (Gabon) en conditions
  normales → c'est le repère de l'écran « Morts ».
- **> 1 % / jour** : suspecter eau, chaleur ou maladie (à confirmer avec la
  consommation d'eau).
- Cumulé (`mortalityPercent` du lot) :
  - Alerte **JAUNE** : mortalité cumulée > **1 %** (`MORTALITY_WARN_PCT`).
  - Alerte **ROUGE** : mortalité cumulée > **5 %** (`MORTALITY_CRITICAL_PCT`)
    → vétérinaire immédiat, vérifier biosécurité et hygiène du bâtiment.

## Écran « Saisie du jour »

- La saisie est bloquée si `morts ≥ effectif vivant` (garde simple).
- Affichage en % du cheptel vivant du jour : > 0,5 % = vigilance,
  ≥ 3 % = action sans attendre (vérifier eau, température, comportement).
- Comparaison à la **moyenne des 7 derniers jours enregistrés**
  (`morts/jour`) :
  - = moyenne : « dans la moyenne » ;
  - > moyenne : « au-dessus, suivez l'évolution » ;
  - < moyenne : « sous la moyenne, bon signe ».

## Tendance et combinaisons

- Une **mortalité en hausse + baisse d'eau** = signe probable de
  **maladie** (alerte combinée `MALADIE`) : baisse d'eau > 10 % ET mortalité
  > 1 % → JAUNE ; l'un des deux critique (eau > 25 % ou mortalité > 5 %) →
  ROUGE. Consigne : contacter le vétérinaire, vérifier abreuvement,
  alimentation et biosécurité.
- Une mortalité éparse à 0,05–0,1 %/jour avec pic ponctuel = souvent accident
  (étouffement, piétinement) ; un pic qui **persiste** = pathologie à
  investiguer (autopsie conseillée).