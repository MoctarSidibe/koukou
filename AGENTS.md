# KouKou Ferme — AGENTS

Poultry farm management app (**offline-first**) for Gabon (SaaS). Monorepo: `backend/` (NestJS), `web/` (admin console), `mobile/` (Expo prototype), `docs/`. GitHub: https://github.com/MoctarSidibe/koukou. Modules 1–5 delivered.

## Backend commands (from `backend/`)

- `npm run start:dev` — dev watch · `npm run build` — compile (**serves as typecheck**, no dedicated script) · `npm run lint` — **oxlint** · `npm run format` — prettier on `src/**` and `test/**`
- `npm run test` — unit tests (`**/*.spec.ts`) · `npm run test:e2e` — e2e (`**/*.e2e-spec.ts`)
- **e2e requires a local PostgreSQL.** Config via `backend/.env` (gitignored, **no `.env.example`**). Defaults: `localhost:5432`, user `postgres`, password `postgres`, database `koukou_ferme`
- **e2e runs sequentially** (`fileParallelism:false`, `maxWorkers:1`) — specs share the same DB and boot `AppModule` with `synchronize:true`

## Critical backend conventions

- **Relative imports MUST end in `.js`** (`from './app.module.js'`) — tsconfig uses `nodenext`; omitting it breaks the build. Applies in tests too.
- **No migrations** — TypeORM `synchronize: true`, schema recreated at boot. Seed is idempotent (`src/database/database-seed.service.ts`, `onApplicationBootstrap`).
- **All routes protected** — global `JwtAuthGuard` (401 without Bearer), global `RolesGuard`. Only `/auth/register` and `/auth/login` are public. Auth = **phone + code secret**, token 7 days.
- **DB columns snake_case** (`@Column({ name: 'foo_bar' })`), TS fields camelCase. Enums in `src/common/enums/`. DTOs with class-validator, **error messages in French**. Swagger at `/api-docs` on :3000.
- **e2e tests**: unique IDs using timestamps (`+24170${Date.now()}`), emails `*.e2e.ga`. Each spec boots a full `AppModule` against the real DB.
- **PDFs via pdfmake 0.3.11**: write fonts with `virtualfs.writeFileSync`, `addFonts(...)`, then `createPdf(dd).getBuffer()` returns a **Promise**. Call `setUrlAccessPolicy`/`setLocalAccessPolicy(() => false)` to suppress warnings. Types at `src/common/types/pdfmake-vfs.d.ts`.
- **PdfService is shared** at `src/common/services/pdf.service.ts` (used by finance, slaughter, health). Exposed via `CommonModule`.
- **Readiness auto-signal (commercialisation)**: calculé à la lecture dans `MetricsService.compute()` (`readyForSale`/`readyReason`) — CHAIR prêt si `ageDays >= VENTE_AGE_MIN_DAYS` (seed 35), statut ≠ ROUGE et `fcrDeviationPct <= VENTE_FCR_DEV_MAX_PCT` (10); PONDEUSE réformable si `layRateDeviationPct < -REFORME_LAY_RATE_FALL_PCT` (15). `ProductionBatch.readyForSaleAt` (`ready_for_sale_at`) persisté dans `batches.service.afterChange`; `BatchStatus.EN_VENTE` reste une sortie de secours manuelle.

## Language & roles

- **UI / user messages / errors / alerts / tips: FRENCH**
- **Code identifiers (variables, DB tables, functions): ENGLISH**
- Roles: `PLATFORM_ADMIN` (inherits all PROPRIETAIRE rights via `RolesGuard`), `PROPRIETAIRE` (full farm access), `ELEVEUR` (restricted: can sell, view caisse, do entries; cannot open/close caisse, manage team, or create/process slaughter orders)
- PLATFORM_ADMIN account created **exclusively via env vars** (`PLATFORM_ADMIN_EMAIL`/`PHONE`/`PASSWORD`) at seed. If vars missing, no admin is created.
- `Farm.active` and `User.active`: suspended farm → reads OK but sales blocked (400); suspended user → login refused (401)

## Module map (`src/modules/`)

| Module | Key files / concepts |
|---|---|
| `auth` | Phone+code login, auto-create default farm for new PROPRIETAIRE |
| `batches` | Module 1 core: `advisory.engine.ts`, `metrics.service.ts` |
| `daily-entries` | Daily worker entries (deaths, feed, water, weight, eggs) |
| `inputs` | HACCP `InputLot` for feed/medication stock |
| `alerts` | Rule registry, persisted alerts, French messages |
| `sanitary` | Module 2: protocols, prophylaxis, treatments, health events |
| `feed-stock` | Module 3: `FeedPhase`/`FeedEntryType`, FEFO, never-negative-stock |
| `finance` | Module 4: POS (cash only), sales, caisse, customers, P&L, PDF receipts |
| `orders` | Précommandes & bons de commande: `order` = wrapper autour d'une `Sale`, snapshot JSONB `items`, acomptes via `recordPayment`, réservation souple du cheptel, PDF bon de commande |
| `slaughter` | Module 5: orders (INTERNAL/EXTERNAL), bordereau PDF, health passport |
| `tasks` | Équipe: `FarmTask` (A_FAIRE…), assignable to employee/batch, overdue `TACHE` alert. ELEVEUR sees only own tasks |
| `advisory` | `GET /farms/:farmId/advisory/next-actions` — aggregated for mobile |
| `platform` | `/admin/*` — PLATFORM_ADMIN only: metrics, provisioning, config |

## Key invariants (would cause bugs if missed)

### Feed stock (Module 3)
- **FEFO auto-assignment**: consumption is auto-assigned to the first eligible non-expired lot with available stock for the phase. Never allow negative stock.
- Quantity calculation differs by `entryType`: `BULKER`/`MATIERE_PREMIERE` → `tonnageMt × 1000` kg; `BAG` → `numberOfBags × bagSizeKg`; `MEDICAMENT` → not counted in kg autonomy (it's a dose).
- Feed alert (`ALIMENT`): RED if autonomy < 3 days, YELLOW if < 5. Recommendation includes suggested reorder quantity.

### Finance (Module 4)
- **Cash only** at MVP (Mobile Money shows "coming soon"). Amounts are **integer FCFA**.
- `POULET_PIECE` sale: integer quantity mandatory. `PROVENDE` sale: `inputLotId` required (HACCP traceability). `POULET_KG`: `pieceCount` required, `quantityAlive -= pieceCount`.
- **Cash register (caisse) can never go negative** — outgoing > available balance → 400. Open/close/movements = PROPRIETAIRE only.
- Cancellation uses pessimistic locks on both the sale and the lot; refunds require open caisse session and sufficient balance.
- P&L auto-deducts chick cost + feed costs (InputLot kind=ALIMENT linked to batch). Do NOT re-enter these as manual expenses.
- **Customers captured find-or-create by phone at POS — non-blocking** (sale proceeds even if capture is skipped/incomplete). Phone normalized (spaces/dashes stripped). Segments NOUVEAU/REGULIER/TOP computed server-side.
- **Promotions**: code stored **uppercase, unique per farm** (409 on duplicate), type `PCT|FCFA`, optional `minSubtotalFcfa` + `customerId` targeting, reusable. Applied in the POS transaction, discount traced on the receipt; discounted sale still enforces never-negative-caisse.

### Commandes & bons de commande (`orders`)
- **`Order` enveloppe une `Sale`** : création = bon de commande/précommande sans décrémenter le cheptel. La livraison (`fulfil`) décrémente `quantityAlive` (verrou pessimiste) ou vérifie le stock d'œufs.
- **État machine** : `PENDING → CONFIRMED (acompte) → LIVRE | CANCELLED`. `livrer` refuse non-CONFIRMED (400). Annulation = `SalesService.cancel(..., { skipStockRestore: true })` — le cheptel n'ayant pas été décrémenté, rien n'est réintégré.
- **Réservation = cap souple calculé serveur** : `vivants − Σ oiseaux des commandes non LIVRE/CANCELLED`. Multi-lots refusé : une commande = un lot.
- **Acomptes via `PaymentsService.recordPayment`** : caisse CASH ouverte requise, montant ≤ reste dû (le total de la vente enveloppée est la référence). Références `CMD-YYYYMMDD-######` / `VTE-`.
- **Snapshot JSONB `items`** : prix figés au bon de commande; les quantités finales (`POST :id/livrer`) recalculent montants et resynchronisent le snapshot.
- Volaille uniquement (POULET_PIECE/KG, OEUFS) : PROVENDE/AUTRE restent sur le POS direct.

### Slaughter (Module 5)
- Strict state machine: `DRAFT → SENT → PROCESSED | CANCELLED`. `process` refuses non-SENT (400). PROCESSED/CANCELLED are immutable.
- `birdCount ≤ quantityAlive` enforced at send AND process (pessimistic lock in transaction).
- **Sanitary criteria block shipment**: active `DELAI_ATTENTE` or `PROPHYLAXIE` RED → 400 on `POST :orderId/send`.
- **Rendement optional, non-blocking**: `carcassWeightKg` set at process → `rendementPercent = carcass/liveWeight ×100`. Carcass **cannot exceed** live weight (400). `carcassWeightKg` without `totalWeightKg` keeps rendement null.

### Sanitary (Module 2)
- **All dates compared in UTC** (`YYYY-MM-DD`) — never mix local and UTC dates.
- PROPHYLAXIE RED if care is `EN_RETARD`, YELLOW if next care ≤ `calendar_lead_days`.
- Health events `REFORME` or `MORTALITE` with `quantity>0` decrement `quantityAlive` immediately (pessimistic lock). Deletion restores it.
- DELETE health event = PROPRIETAIRE only (403 for ELEVEUR).

### Advisory & alerts
- **Advisory only, never blocking** — even for HACCP and sanitary. Red alert + recommendation + trace; user decides.
- Water is the #1 indicator. Combined `MALADIE` alert: water drop + rising mortality → RED/YELLOW.
- Alerts go `ACTIVE → RESOLÉ` when risk disappears; manual `ACKNOWLEDGE` → `ACQUITTÉE` (re-raised if risk persists).

## Web console (`web/`)

- SPA: **Vite + React 18 + TS strict + Tailwind v4 + react-router v6 + TanStack Query v5 + lucide-react**
- **PLATFORM_ADMIN only** — farmers use `mobile/`. Non-admin login refused with `MobileOnlyScreen`.
- Commands (from `web/`): `npm run dev` (proxy `/api` → `localhost:3000`) · `npm run build` = `tsc --noEmit` + `vite build` · `npm run lint` (oxlint) · `npm run format` (prettier) · `npm run types` = generate OpenAPI types (needs backend running; output committed but **not imported** — local `src/api/types.ts` is authoritative)
- Types: `src/api/client.ts` (fetch + localStorage token `koukou.token` + `.download()` for PDFs) · `src/api/types.ts` (local interfaces, NOT the generated schema)
- Routes: `/login`; `/app` shell → `dashboard|batches|alerts|finance|stock|sanitary|slaughter|team|settings`; `/app/platform` gated to PLATFORM_ADMIN. Admin lands on `/app/platform` via HomeRedirect.
- Colors: `--color-brand-*` (teal `#206080`), `--color-accent-*` (orange `#F08010`) in `src/index.css` `@theme`

## Mobile (`mobile/`)

- **Expo SDK 54** + React Native 0.81.5 + React 19.1 + expo-router ~6.0.24 + TS ~5.9.2
- SDK 54 chosen because Expo Go in stores was stuck on SDK 57 (not yet approved); SDK 55+ won't run in store Expo Go.
- No NativeWind — StyleSheet + theme tokens. UI in French, code in English.
- **Client API facade**: `src/api/index.ts` switches between mock (`src/api/mock.ts`) and live (`src/api/live.ts`) based on session. Always import from `@/api`, **never** `@/api/mock` directly in screens.
- Commands (from `mobile/`): `npm run start` · `npm run typecheck` (= `tsc --noEmit`, **no `build` script**) · `npm run lint` (= **`eslint .`** — `npx expo lint` crashes on Node 22) · `npm run test` (= `vitest run`, environment node, tests in `src/api/*.test.ts` + `src/offline/engine.test.ts`)
- **React Compiler rule** (lint `react-hooks/purity`): `Math.random`/`Date.now` must live **outside render** in module-scope helpers (e.g. `SaleSheet.demoSaleRef`, `newIdempotencyKey`).
- **`CustomTabBar` uses intentionally loose types** (`state`/`navigation` typed loosely, `emit/navigate` as `any`) — the types from `@react-navigation/bottom-tabs@7` forked by expo-router are incompatible. Do NOT reimport `BottomTabBarProps`.

### Windows gotcha
- **Never use `Get-Content`/`Set-Content`** (PS 5.1) on French UTF-8 files — it reads ANSI and writes UTF-8+BOM → mojibake (win-1252). Use the `write`/`edit` tools or .NET `UTF8Encoding($false)`. Check: no `Ã©`/`Ã§`/`â€¦` in output.

### Node 22 quirk
- `expo-haptics` and `expo-sharing` **must NOT be listed in `plugins`** in `app.json` — they're runtime-only with no `app.plugin.js`, and Expo resolves their TS entry → crashes with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. Do not re-add plugin-less packages to `plugins`.

## Offline sync (`mobile/src/offline/`)

- Custom engine, no dependencies. FIFO queue of `OfflineOp` in `localStorage`/memory.
- Network failure (`TypeError` or `ApiError ≥ 500`) → enqueue; 4xx propagated as real errors / dropped at flush.
- Pending sale uses `idempotencyKey = op.id` → retry without duplicates. Customer info (`customerName`/`customerPhone`/`promoCode`) preserved through queue and online POST.
- `flushQueue()` stops at first unsendable op, returns `{synced, dropped, remaining}`.
- `OfflineAutoSync` component (mounted in `_layout.tsx`): flushes on connection transition or new pending op, guarded by refs to avoid loops.
- Cache invalidation after successful sync via `invalidateFarmQueries(queryClient, {farmId, batchId?})`.

## Seeded data

- Breeds: Chair (Cobb 500, Hubbard, Ross 308), Pondeuses (ISA Brown, Lohmann Brown). Custom breeds via `POST /breeds`.
- Constants: `standard_module`=3000 (POUFA reference), density 15/18 birds/m², empty-clean 14–21 days, age gap 4 weeks, mortality/water/feed/IPE/GMQ thresholds.
- Protocols: `proto-poulet-chair-standard`, `proto-poule-pondeuse-standard` + Gabon vaccination programs (`GABON_VACC_PROTOCOLS`).
- Reference constants: `GET /reference-constants` (read for PROPRIETAIRE+ELEVEUR), `PATCH` only by PLATFORM_ADMIN. Values strictly positive (0 rejected).

## What's NOT yet built

- PostGIS, FinTech / Mobile Money (escrow)
- KouKou Market (le **back est livré** : précommandes/bons de commande `orders` + auto-signal de disponibilité, mais ni marketplace, ni canal client public)
