# KouKou Ferme — AGENTS

Application mobile de gestion avicole **offline-first** pour le Gabon (SaaS, mobile-only, pas de web). Monorepo : `backend/` (NestJS, actif), `mobile/` (**vide**, phase ultérieure), `docs/`. Repo GitHub : https://github.com/MoctarSidibe/koukou. Source de référence : **Gabon avicoles 2.docx** (CDCF) — focus **Module 1 : Gestion des Lots (Suivi Technique Zootechnique)**. Plan futur abattage/traçabilité dans `docs/abattage-tracabilite-plan.md`.

## Stack & commandes (depuis `backend/`)
- **NestJS 12 + TypeORM + PostgreSQL + Swagger**. Tests : **Vitest + supertest** (pas Jest). PostGIS et FinTech/Mobile Money : prévus au CDCF, **pas encore implémentés**.
- `npm run start:dev` (dev watch) · `npm run build` (compile; sert de *typecheck*, il n'y a pas de script dédié) · `npm run lint` (**oxlint**) · `npm run format` (prettier sur `src/**` et `test/**`).
- `npm run test` = unitaires (`**/*.spec.ts`) · `npm run test:e2e` = e2e (`**/*.e2e-spec.ts`), **forcés séquentiels** (`fileParallelism:false`), **exigent un PostgreSQL local** configurable via `backend/.env` (gitignoré, pas de `.env.example`). Sans `.env`, défauts : `localhost:5432`, `postgres/postgres`, base `koukou_ferme`.

## Conventions code (vérifiées — erreurs probables)
- **Imports relatifs : TOUJOURS suffixés `.js`** (`from './app.module.js'`) — tsconfig en `nodenext`, l'omettre casse le build. Ça vaut aussi dans les tests (`./../src/app.module.js`).
- **Pas de migrations** : TypeORM `synchronize: true` par défaut, schéma (re)créé au boot. Seed idempotent au boot (`src/database/database-seed.service.ts`, `onApplicationBootstrap`) : constantes (`reference_constants`), souches par défaut, `RuleRegistry`.
- **Toutes les routes sont protégées** : `JwtAuthGuard` global (401 sans `Authorization: Bearer`), `RolesGuard` global + `@Roles(UserRole.PROPRIETAIRE, ELEVEUR, ...)`. Seuls `/auth/register` et `/auth/login` sont publics (login par phone OU email, token 7 j). Visibilité ferme : `farmsService.assertAccessible()` → 403 (Voir test `module1.e2e-spec.ts`).
- **Colonnes DB en snake_case** (`@Column({ name: 'foo_bar' })`), champs TS en camelCase. Enums dans `src/common/enums/`. DTOs en `class-validator` (**messages d'erreur en français**). Swagger : `/api-docs` (:3000), `ValidationPipe` global (`whitelist`, `transform`).
- **e2e** : chaque spec boote `AppModule` complet contre la vraie base ; identifiants uniques horodatés (`+24170${Date.now()}`, emails `*.e2e.ga`).

## Modules backend (`src/modules/`)
`auth` · `users` · `farms` (rôles Propriétaire/Éleveur) · `buildings` · `breeds` · `batches` (noyau Module 1 : `advisory.engine.ts`, `metrics.service.ts`) · `daily-entries` · `inputs` (HACCP `InputLot`, `unitPriceFcfa` optionnel) · `alerts` (rule registry → alertes persistées) · `reference-constants` · `sanitary` (Module 2 : protocoles/prophylaxie/traitements ; alertes `PROPHYLAXIE`/`DELAI_ATTENTE` évaluées par `SanitaryService.refreshProphylaxis`, appelée après chaque mutation sanitaire) · `feed-stock` (Module 3 : inventaire provende, pertes, alerte `ALIMENT` via `FeedStockService`, rappelé après chaque mutation d'input/saisie journalière/perte) · `finance` (Module 4 : POS espèces, ventes/décrémentation stock, clients & crédit, caisse journalière, dépenses CDCF, rentabilité & rapports PDF, alertes `RENTABILITE`/`VENTE` ; `pdf.service.ts`, `finance-events.service.ts`).

## Sanitaire : API & règles (Module 2)
- Protocoles référentiels (seed `proto-poulet-chair-standard`, `proto-poule-pondeuse-standard`) : `GET/POST /sanitary/protocols` (+ `GET /:id` avec étapes).
- Calendrier par lot : `POST /farms/:farmId/batches/:batchId/prophylaxis/generate` (protocole par défaut species/type, idempotent — ne duplique pas si `protocolStepId` déjà présent) · `GET .../prophylaxis` · `POST .../prophylaxis/:eventId/complete|cancel` · `PATCH .../prophylaxis/:eventId` (reporter).
- `scheduledDate = integrationDate + dayFrom` ; soin `PLANIFIE` passé de `prophylaxie_retard_warn_days` (1 j) → `EN_RETARD`.
- Traitements : `POST/GET /farms/:farmId/batches/:batchId/treatments` ; un soin ANTIBIOTIQUE complété avec `withdrawalDays>0` ouvre un `TreatmentRecord` + alerte `DELAI_ATTENTE` ROUGE (commercialisation suspendue) tant que `withdrawalEndDate` ≥ aujourd'hui.
- Alertes : `PROPHYLAXIE` ROUGE si soins `EN_RETARD`, JAUNE si prochain soin ≤ `calendar_lead_days` (1 j). **Dates toutes comparées en UTC** (`YYYY-MM-DD`) — ne pas mélanger Date locale/UTC.

## Stock & Inventaire provende (Module 3)
- Entrée de stock aliment = `InputLot` (Module 1, déjà HACCP : fournisseur, n° lot, péremption). La consommation est saisie dans `daily_entries` (toujours en kg, avec `feedType` et `inputLotId` optionnel pour tracer la déduction par lot).
- Module `src/modules/feed-stock/` (`FeedStockService`) : la table `feed_stock_losses` déclare les **pertes** (sacs gâtés — raison `HUMIDITE|RONGEURS|AUTRE`, quantité en SAC ou KG via `farm.defaultSacKg`).
- **Stock restant par lot** = `reçuKg (SAC→kg) − conso liée (inputLotId) − pertes`, plafonné à 0. La conso NON liée compte pour l'autonomie mais ne décrémente pas les lots. Pas de déduction FIFO automatique (choix validé).
- **Consommation théorique** = moyenne des **3 derniers jours** de saisies (fenêtre `CONSUMPTION_WINDOW_DAYS=3`, depuis `daysAgo(2)`), tous lots de la ferme, par `feedType`.
- **Alerte `ALIMENT` (niveau ferme, batchId nul)** : ROUGE si autonomie < `feed_stock_critical_days` (3), JAUNE si < `feed_stock_warn_days` (5), résolue sinon. Réévaluée après chaque mutation (création input / saisie journalière / perte) **et** en lecture (`GET /feed-stock` = auto-résolution paresseuse).
- **Alerte `PEREMPTION` niveau ferme (batchId nul)** : `FeedStockService.evaluateFeedExpiration` — provende NON rattachée à un lot : ROUGE si périmée ou expire sous 7 j, JAUNE sous 14 j. Les intrants liés à un lot (`batchId`) sont couverts par l'advisory par lot (`AdvisoryEngine.evaluateExpiration`, agrégation : un lot périmé parmi des lots futurs reste signalé).
- API : `GET /farms/:farmId/feed-stock` (summary `byType[]` + `lots[]` + `losses[]`) · `POST/GET .../feed-stock/losses` · `GET .../feed-stock/movements` (journal chronologique pertes + consommations liées, source typée).
- règle seedée `stock-aliment-1` (kind `ALIMENT`) + constantes `feed_stock_warn_days`/`feed_stock_critical_days`.
- Hors périmètre : cheap FIFO auto, ajustement de l'alerte `PEREMPTION` pour ignorer les lots entièrement consommés.

## Finance & POS ferme (Module 4)
- Module `src/modules/finance/` : POS **espèces uniquement** au MVP (Mobile Money / QR « Bientôt disponible »). Montants **entiers FCFA**, messages utilisateur **FR**, évaluation advisory **jamais bloquante** (réponse de création de vente = `{ sale, items, payments, warnings[] }`).
- **Ventes** : `POST/GET /farms/:farmId/sales` (+ `GET :saleId`, `GET :saleId/receipt` → **PDF + QR pdfmake**, `POST :saleId/payments`, `DELETE :saleId` = annulation PROPRIÉTAIRE). Référence `VTE-YYYYMMDD-XXXXXX` (préfixe codé en dur). Statuts `SETTLED | OUTSTANDING | CANCELLED`.
- **Décrémentation d'inventaire** (dans une transaction `dataSource.transaction`) : `POULET_PIECE` → `quantityAlive -= ceil(quantity)` ; `POULET_KG` → `pieceCount` requis, `quantityAlive -= pieceCount` ; `PROVENDE` → `feed_stock_sales` (via `FeedStockService.recordFeedSale(em)`) ; `OEUFS` → alvéoles (lien batch pour P&L) ; `AUTRE` libre. Annulation : réintègre stock + rembourse les paiements (`REFUNDED` + mouvement caisse si session ouverte).
- **Caisse journalière** : `POST/GET /farms/:farmId/caisse/{open|current|sessions|close|movements}` — une session ouverte (sinon 400 sur tout encaissement espèces), clôture calcule `écart = déclaré − attendu` tracé. Dépense `paidByCaisse` → mouvement OUT `EXPENSE`. Hooks `CashMovementSource/Type`.
- **Clients/crédit** : `POST/PATCH/GET /farms/:farmId/customers` + `GET :customerId/balance` (solde à recouvrer = ventes non annulées − paiements CONFIRMED). Paiement > solde restant dû → 400.
- **Rentabilité & rapports** : `GET /farms/:farmId/rentabilite/overview` (+ `/overview/export` PDF, **toute période** `from`/`to`) et `/rentabilite/batches/:batchId` (+ `/export`). P&L lot enrichi de `chickUnitPriceFcfa` (`ProductionBatch`) et `unitPriceFcfa` (`InputLot`, optionnels).
- **Alertes finance** : `rentabilite-1` (kind `RENTABILITE`, ROUGE si perte nette, JAUNE si marge < `rentabilite_marge_min_pct`=5 ; évaluée à la **clôture du lot** via `koukouBus` `BATCH_CLOSED`, `FinanceEventsService`) et `vente-1` (kind `VENTE`, JAUNE : lot EN_VENTE sans vente depuis `vente_invendu_days`=5 ; évaluée après chaque mutation de vente). `RuleCategory` += `'FINANCE'`, `AlertKind` += `RENTABILITE`.
- **pdfmake 0.3.11 (Node)** : écrire les polices base64 dans `pdfmake.virtualfs.writeFileSync(name, Buffer.from(b64,'base64'))`, puis `addFonts({ Roboto: { normal:'Roboto-Regular.ttf', bold:'Roboto-Medium.ttf', italics:'Roboto-Italic.ttf', bolditalics:'Roboto-MediumItalic.ttf' } })` ; `createPdf(dd).getBuffer()` renvoie une **Promise** ; `setUrlAccessPolicy`/`setLocalAccessPolicy(() => false)` pour désactiver les warnings. Types dans `src/common/types/pdfmake-vfs.d.ts`.
- PaymentsService garde des messages FR explicites pour les méthodes désactivées (« Le paiement mobile … arrive bientôt »).
- Tests : `test/finance.e2e-spec.ts` (POS, caisse, crédit, reçus/rapports PDF, alertes finance, annulation, 403).

## Réglages (constantes de référence)
- `GET /reference-constants` (PROPRIETAIRE + ELEVEUR) : liste des constantes (seuils, vide sanitaire, autonomie provende…).
- `PATCH /reference-constants/:key` (PROPRIETAIRE uniquement) : change la valeur (clé existante + `isEditable` sinon 404/400). Constantes **globales** (non par ferme) pour le MVP.

## Convention de langue
- **UI / messages utilisateur / erreurs / alertes / conseils : en FRANÇAIS**
- **Identifiants de code (variables, tables DB, fonctions) : en ANGLAIS**

## Rôles (pas de rôle Agronome)
- **Propriétaire** : voit tout, incluant les métriques de chaque Éleveur (IPE/GMQ, etc.).
- **Éleveur** : compte lié à une ferme, saisie terrain, accès restreint (403 hors ferme rattachée).
- Tab switch Propriétaire/Éleveur = préoccupation mobile (phase ultérieure).

## Module 1 — Scope verrouillé
- **Création de lot :** date arrivée, quantité poussins, souche, **type mutable** (CHAIR | PONDEUSE, transitions loguées dans `type_history`).
- **Unité modulaire :** référence = **3 000** (standard officiel POUFA), **advisory uniquement** (jamais de blocage). Ferme déclare sa propre capacité.
- **Saisie journalière ouvrier :** morts, aliments (**sacs OU kg**, converti à kg — sac par défaut 50 kg, configurable), eau (L), poids moyen hebdo.
- **Métriques Propriétaire (calculées serveur) :** IC, taux mortalité, viabilité, GMQ, IPE, taux de ponte.
- **Suivi ponte :** œufs/jour, tri (commercialisables / fêlés / petits), taux de ponte.
- **Traçabilité HACCP (gouvernementale) :** origine poussins (couvoir, n° lot, date éclosion) + aliment de démarrage (`InputLot` fournisseur, n° lot, péremption), optionnels à la création, modifiables. v2 : alerte ROUGE + conseil + tracé, **PAS de blocage**.
- **Bâtiments (`Building`) :** nom, surface m², capacité, dernier vide sanitaire. Un lot est rattaché à un bâtiment (`buildingId`) ; plusieurs lots (bandes) peuvent coexister.
- **Densité lot :** bande 12–15 oiseaux/m², alerte >15, critique >18. **Densité BÂTIMENT (`DENSITE_BATIMENT`) :** somme des vivants des lots actifs / surface → alerte >15, critique >18 (`building_density_*`).
- **Cohabitation d'âges (`COHABITATION`) :** écart d'âge max 4 sem. (`age_gap_max_weeks`) ; poussin <3 sem. avec bande mature → ROUGE.
- **Vide sanitaire (`VIDE_SANITAIRE`) :** fenêtre 14–21 j (`vide_sanitaire_min/max_days`) modifiable en réglages. Alerte ROUGE + conseil, **PAS de blocage**, tracé dans l'historique.
- **Advisory :** évalué après chaque mutation du lot (création, mise à jour, changement de type, VENTE, **CLOTURE**, saisie journalière). Détacher un lot d'un bâtiment purge les alertes de niveau bâtiment de l'ancien bâtiment. Les early-return (données insuffisantes : surface nulle, < 2 saisies eau, IPE/GMQ indisponible) **nettoient** les alertes préexistantes (pas d'alerte zombie).

## Assistant & Alertes (dans le MVP)
- Engin d'alertes par **règles** (rule registry), réutilisable pour les modules 2-6. Alertes persistées, **messages FRANÇAIS**, statut vert/jaune/rouge + recommandation.
- Eau = indicateur n°1 → alerte jaune sur baisse. Aussi : baisse aliment, pic mortalité, surdensité, densité bâtiment, cohabitation, vide sanitaire, déviation IPE/GMQ, péremption (HACCP), traçabilité incomplète.
- **Cycle de vie :** `ACTIVE` → `RESOLUE` (`resolvedAt`) quand le risque disparaît ; reste dans l'historique et dans les rapports 360° (`GET /farms/:farmId/alerts/history`). **Acquittement manuel :** `POST /farms/:farmId/alerts/:alertId/acknowledge` (PROPRIETAIRE + ELEVEUR) → `ACTIVE` → `ACQUITTEE` (le fermier reconnaît l'alerte ; re-levée si le risque persiste). Tout est tracé.
- **Alerte `GMQ` (`gmq-1`, constante `gmq_deviation_warn_pct`=10)** : le lot sert de référence à lui-même — JAUNE si le GMQ cumulé baisse de ≥ warnPct vs la dernière pesée précédente (≥ 7 j d'écart).
- **Philosophie : advisory uniquement, JAMAIS de blocage** (y compris vide sanitaire et HACCP) — alerte ROUGE + conseil + traçage ; l'utilisateur reste décisionnaire. Backend émet des événements d'alerte ; push/locales = phase mobile.

## Décisions / conventions
- Souches — Chair : Cobb 500, Hubbard, Ross 308 · Pondeuses : ISA Brown, Lohmann Brown (+ ajout custom via `POST /breeds`).
- Constantes seedées : `standard_module`=3000, densité 15/18, vide sanitaire 14–21 j, écart d'âge 4 sem., `building_density_*`, seuils mortalité/eau/aliment/IPE/GMQ.
- FinTech / Mobile Money (escrow) : déféré.

## État d'avancement (checkpoint)
- **Modules 1–4 livrés sur `main`** (GitHub : https://github.com/MoctarSidibe/koukou) — commits `d8e67c2` (M2), `14b0af5` (M3), `7adabea` (M4). Module 1 (lots/advisory/métriques) et la base (auth, fermes, alertes, constantes) faisaient partie des commits antérieurs.
- **Module 4 « Finance & Rentabilité »** : FAIT et validé — POS espèces (Mobile Money/QR « Bientôt disponible »), ventes avec décrémentation du cheptel/aliment (`POULET_PIECE`/`POULET_KG`/`PROVENDE`/`OEUFS`/`AUTRE`), clients & crédit (solde à recouvrer), caisse journalière (ouverture/clôture/écart/mouvements), dépenses CDCF (`paidByCaisse` → sortie caisse), rentabilité par lot + rapport de période **toute période** avec exports **PDF (pdfmake, QR sur reçus)**, alertes `RENTABILITE` (clôture lot) et `VENTE` (invendus).
- **Qualité** : `npm run build` OK (sert de typecheck), lint OK (1 warning préexistant dans `test/feed-stock.e2e-spec.ts` : `lotBId` inutilisé), **e2e 62/62 verts** (`npm run test:e2e`, PostgreSQL local) — 17 tests d'origine + 4 de régression dans `test/finance.e2e-spec.ts`.
- **Audit finance (commit `772e5f8`)** — bugs corrigés : listes `GET /sales` et `GET /expenses` plantaient sur `sale.created_at`/`expense.created_at` (colonnes `created_at`/`updated_at` renommées en snake_case sur toutes les entités finance + feed-stock) ; idempotence paiement maintenant scopée par `saleId` (une clé réutilisée sur une autre vente ne renvoie plus l'ancien paiement) ; alerte `VENTE` (invendus) calculée depuis les **articles** (`sale_items.batch_id`) ET la vente — une vente liée par item éteint bien l'alerte ; garde de stock provende POS (vente > stock disponible → 400 comme le cheptel) ; verrou pessimiste (`pessimistic_write`) sur le décrément du cheptel en vente ; le correctif de libellé d'une dépense payée en caisse synchronise la raison du mouvement de caisse.
- **Enrichissement daté (MVP actuel)** : `InputLot.unitPriceFcfa` et `ProductionBatch.chickUnitPriceFcfa` sont **optionnels** ; le P&L lot les affiche en `enrichment` (coûts poussins/aliments) mais ils ne sont PAS déduits du `netFcfa` — à brancher en v2 selon décision.
- **Reste à faire (hors MVP finance)** : application mobile (`mobile/`, vide), FinTech/Mobile Money + PostGIS, module abattage/traçabilité (`docs/abattage-tracabilite-plan.md`), déduction automatique des coûts d'achat dans le P&L, rôles Éleveur au POS (comptes `ELEVEUR` non testés en e2e faute d'endpoint de création — le register crée toujours `PROPRIETAIRE`).