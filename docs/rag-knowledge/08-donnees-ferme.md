# Données ferme — modèle et logique de l'écran « Saisie du jour »

## Le BCD : une saisie par lot et par jour

Table `daily_entries`, unique `(batch_id, entry_date)` — réserver la même date
met à jour la saisie existante (pré-remplissage + mise à jour, pas de doublon).

Champs (TS / colonne SQL snake_case) :
- `batchId` / `batch_id` — lot concerné
- `entryDate` / `entry_date` — date de la saisie (UTC `YYYY-MM-DD`)
- `deaths` — morts du jour
- `feedQuantity` / `feed_quantity` — kg équivalent consommés
- `feedUnit` / `feed_unit` — `KG` | `SAC`
- `feedType` / `feed_type` — nature de l'aliment
- `feedPhase` / `feed_phase` — phase (POUSSIN…PERSONNALISE)
- `inputLotId` / `input_lot_id` — lot interne déduit (null si FEFO/externe)
- `skipStockDeduction` / `skip_stock_deduction` — `true` = achat externe
  (consommation enregistrée, aucun stock déduit)
- `waterL` / `water_l` — litres d'eau consommés
- `avgWeightKg` / `avg_weight_kg` — poids moyen (saisi en g, stocké en kg)
- `eggsCollected` / `eggs_collected` — œufs collectés du jour
- `eggsSellable` / `eggs_sellable` — vendables (collectés − écarts)
- `eggsCracked` / `eggs_cracked`, `eggsSmall` / `eggs_small`,
  `eggsDoubleYolk` / `eggs_double_yolk`, `eggsDirty` / `eggs_dirty`
- `createdById`, `source` (MANUELLE…), `createdAt`, `updatedAt`

## Flux mobile

`DailyEntrySheet` (écran « Saisie du jour », 4 étapes : Morts → Aliments & Eau
→ Œufs → Poids) :

1. **Assistant** : indicateur d'étapes (on peut revenir en arrière), chaque
   étape marquée complète si ≥ 1 valeur renseignée ; final, `save` envoie via
   la file hors-ligne (retry automatique au retour en ligne, jamais de perte).
2. **Contexte** : sélecteur de lot actif, date du jour / hier / personnalisée
   (≤ aujourd'hui), cartouche lot (J, S, vivants, départ, mortalité cumulée %).
3. **Analyses en direct**, recalculées à chaque frappe (voir fichiers
   `01-eau` à `05-mortalite`) :
   - Morts : % du vivant, tendance vs moyenne 7 j.
   - Aliments & Eau : provenance (interne/externe), phase + autonomie,
     g/oiseau/j et L/oiseau/j avec delta vs moyenne 7 j, ratio eau/aliment
     (norme 1,8–2,6) avec barre, alerte si eau −10 % vs hier.
   - Œufs : alvéoles (30) + vrac, écarts plafonnés au total, % rebuts
     (objectif < 5 %), taux de ponte vs objectif souche de la semaine.
   - Poids : protocole 30 sujets, objectif souche S, delta vs dernière + GMQ.
4. **Repères récupérés** : `feed-stock` (byType, lots FEFO, autonomie),
   `breed-standards` (poids/ponte cible à la semaine), `daily-entries`
   (historique 7 j), `batches` (métriques).

## Données client récupérées par endpoint

- `GET /batches` — lots + `batch.metrics` (ageDays, liveCount, mortalityPercent,
  ipe, gmqGramsPerDay, densityPerM2, layRate).
- `GET /daily-entries/:batchId` — historique des saisies (sert aux moyennes).
- `GET /feed-stock` — par phase : `byType[]` (autonomyDays, suggestedLotId),
  `lots[]` (productName, availableKg, expirationDate, feedPhase).
- `GET /breed-standards/:breedId` — courbes hebdo (targetAvgWeightKg,
  targetLayRatePercent).
- `GET /advisory/next-actions` — actions agrégées pour le mobile.

## Consignes pour des conseils fiables

- Toujours normaliser par l'**effectif vivant estimé à la date de la saisie**.
- Comparer sur des **fenêtres identiques** (7 j glissants avant la date).
- Ne jamais conclure « maladie » sans le **couple eau + mortalité**.
- Les seuils viennent des **constantreferences** (ajustables) ; les citer avec
  leurs valeurs par défaut : eau 10 %/25 %/0,2 L, mortalité 1 %/5 %,
  densité 15/18, vide sanitaire 14–21 j, écart d'âge 4 sem., IPE/GMQ 10 %.

## Hors périmètre de cet écran

Ventes, caisse, acomptes, promotions (POS/finance) ; abattage (module 5) ;
planning sanitaire (module 2) ; entrées de provende au stock (module 3,
« Provende & stock ») — les saisies du jour ne **consomment** que le stock,
elles ne l'approvisionnent pas.