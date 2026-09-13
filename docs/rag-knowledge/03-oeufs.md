# Œufs — collecte, écarts, taux de ponte

## Saisie en alvéoles

- **1 alvéole = 30 œufs.** La saisie se fait par alvéoles pleines + œufs en
  vrac (0–29), le total est recalculé automatiquement :
  `total = alvéoles × 30 + vrac`. L'éleveur peut aussi passer en nombre direct.
- Affichage immédiat : « Total : N œufs · ≈ M alvéole(s) + X œuf(s) ».

## Écarts (rebuts) par type

Quatre types de rebuts, déduits des œufs vendables :
- **Cassés / fêlés** (`eggsCracked`)
- **Petits** (`eggsSmall`)
- **2 jaunes** / doubles (`eggsDoubleYolk`)
- **Sales** (`eggsDirty`)

Chaque écart est plafonné au total collecté du jour. Les
**vendables = collectés − Σ écarts** (jamais négatif).

- Objectif : **< 5 %** de rebuts.
- **> 8 %** : vérifier nids, litière (propreté → œufs sales), manipulation et
  qualité de la coquille (deux jaunes fréquents chez les jeunes pondeuses en
  début de ponte ; œufs mous/coquille fragile → calcium/phosphore, chaleur).

## Taux de ponte

- `taux = œufs collectés du jour / effectif vivant`.
- Comparaison à l'**objectif de la souche à la semaine du lot**
  (courbe de ponte du référentiel, ex. ISA Brown, Lohmann, Hy-Line…).
- Écart **< −8 pts** par rapport à l'objectif → vigilance : alimentation, eau,
  stress (chaleur, litière, pic de ponte non soutenu).
- Sur le serveur, le taux de ponte affiché en métrique est une **fenêtre
  glissante de 7 jours** (et non le cumul sur toute la vie du lot).

## Conseils

- Un pic de ponte doit être soutenu par une ration adaptée (phase
  `PONTE_PHASE_1`), une eau fraîche abondante et un ratio eau/aliment dans les
  normes (1,8–2,6).
- Les rebuts se comptent **chaque jour** : un pic de cassés signale souvent un
  problème mécanique (ramassage) ou une carence, pas seulement de la casse au
  tri.