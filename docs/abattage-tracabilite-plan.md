# Plan — Module « Abattage & Traçabilité » (base, approche légère)

> Statut : **PLAN à conserver** (non implémenté). Module futur, dans la continuité du Module 1 (Gestion des Lots).
> Messages/erreurs UI en **FRANÇAIS**, identifiants de code en **ANGLAIS** (convention du repo).

## Objectif

Permettre à une ferme de tracer le passage d'un lot de production vers l'abattage, avec une identification simple, un bordereau d'envoi quand l'abattoir est externe, et une base prête pour **KouKou Market** (vente vivant/abattu) et le **scan consommateur** (plus tard).

## Décisions de conception (validées)

- **Approche légère**, aucune complexité inutile.
- Traçabilité au niveau **lot** (jamais par oiseau individuel).
- **Statut abattoir au niveau de la ferme** : `INTERNE` (le système génère le code d'abattage) ou `EXTERNE` (bordereau + champ manuel pour le code abattoir fourni par le processeur).
- **Rien de bloquant** (même philosophie que le Module 1) : le code abattoir (`abattoirLotCode`) est **optionnel/vide** — la traçabilité fonctionne déjà via le n° de bordereau/ordre interne (`referenceNumber`) + `batchId`.

## 1. Modèle de données (nouvelles entités)

### `SlaughterOrder` (ordre d'abattage)

| champ | type | notes |
|---|---|---|
| `id` | UUID | PK |
| `farmId` | UUID FK | ferme |
| `batchId` | UUID FK | `ProductionBatch` source (bande) |
| `referenceNumber` | string | n° d'ordre interne auto-généré (ex. `ABT-2026-0001`) |
| `slaughterType` | enum | `VIVANT` \| `ABATTU` (base pour le futur Market) |
| `destination` | enum | `INTERNE` \| `EXTERNE` (statut abattoir) |
| `plannedDate` | date | date prévue d'abattage |
| `birdCount` | int | nb d'oiseaux envoyés |
| `totalWeightKg` | decimal, nullable | (optionnel) |
| `internalBatchCode` | string, nullable | **auto-généré si INTERNE** |
| `abattoirLotCode` | string, nullable | **manuel, vide si EXTERNE** → saisi plus tard |
| `status` | enum | `DRAFT` → `SENT` → `PROCESSED` \| `CANCELLED` |
| `processedAt` | timestamptz, nullable | = **date de mort** |
| `abattoirNotes` | text, nullable | remarques |
| `createdAt` / `updatedAt` | | |

> Remarque v1 : `batchId` requis à la création (simplicité). À discuter plus tard si on veut du « stock mort » d'abattoir sans lot source.

### Constante (table `app_settings`)

- `abattoir_reference_prefix` = `ABT` (éditable). On réutilise le pattern `referenceNumber` déjà en place au Module 1 — aucun compteur séparé.

## 2. Flux métier (3 étapes)

```
[Ferme choisit statut] --INTERNE--> système génère internalBatchCode  → PROCESSED (abattoir propre)
                       --EXTERNE--> génère bordereau (n° référence) → l'envoie au processeur « comme d'hab »
                                                                   → plus tard : saisie manuelle abattoirLotCode → PROCESSED
```

**Cas INTERNE (abattoir propre) :**
1. Créer l'ordre avec `destination = INTERNE`.
2. Le système génère `internalBatchCode` (ex. `ABT-2026-0001-A`).
3. Quand c'est fait : `status = PROCESSED`, `processedAt = now` (= date de mort).

**Cas EXTERNE (abattoir externe) :**
1. Créer l'ordre avec `destination = EXTERNE`.
2. Générer le **bordereau** (`referenceNumber`) — PDF/imprimable, envoyé comme d'habitude. **Champ `abattoirLotCode` laissé VIDE.**
3. À réception du retour du processeur : **saisie manuelle** du `abattoirLotCode` sur le bordereau/ordre.
4. `status = PROCESSED`, `processedAt = now` (= date de mort).

> Le `abattoirLotCode` est **optionnel** : même sans lui, la traçabilité remonte via `referenceNumber` + `batchId`. PATCH possible après l'envoi (jamais bloquant).

## 3. API REST (nouveau module `slaughter/`)

Route de base : `/farms/:farmId/slaughter-orders`

| méthode | route | rôle | description |
|---|---|---|---|
| `POST` | `/` | PROPRIETAIRE | créer un ordre d'abattage (définit type + destination) |
| `GET` | `/` | PROPRIETAIRE, ELEVEUR | lister les ordres de la ferme |
| `GET` | `/:id` | PROPRIETAIRE, ELEVEUR | détail (avec lien batch) |
| `PATCH` | `/:id` | PROPRIETAIRE | modifier (dates, nb, `abattoirLotCode` manuel) |
| `POST` | `/:id/send` | PROPRIETAIRE | marquer `SENT` (génère bordereau/n° si EXTERNE) |
| `POST` | `/:id/process` | PROPRIETAIRE | marquer `PROCESSED` (+ `processedAt` = date de mort) |
| `POST` | `/:id/print-bordereau` | PROPRIETAIRE | générer/renvoyer le bordereau (PDF) |
| `POST` | `/:id/cancel` | PROPRIETAIRE | annuler (`CANCELLED`) |

**Règles simples :**
- `SENT` exige `batchId` + `birdCount`.
- `abattoirLotCode` : modifiable à tout moment (PATCH), jamais bloquant.
- `PROCESSED` est l'état final (immuable, sauf admin — hors scope v1).
- Éleveur en lecture seule (cohérent avec Module 1).

**DTOs :** `CreateSlaughterOrderDto`, `UpdateSlaughterOrderDto`, `SendSlaughterOrderDto`, `ProcessSlaughterOrderDto`.

## 4. Piste future (documenté, non implémenté maintenant)

- **KouKou Market** : `slaughterType = VIVANT/ABATTU` est la cheville pour publier un lot/l'abattage en vente (vivant = sur pied, abattu = après `PROCESSED`). Le flux **précommande → commande → paiement** sera son propre module/market (gros plan séparé).
- **POS + scan consommateur** : le QR référencera `internalBatchCode`/`abattoirLotCode` + `referenceNumber`, et remontera via `batchId` à ferme/bâtiment/bande/aliments + `processedAt` (= date de mort). La traçabilité remonte déjà grâce au `batchId`.

## 5. Fichiers/modules concernés (pour référence future)

- `backend/src/modules/slaughter/` (nouveau module) : `entities/slaughter-order.entity.ts`, `dto/*`, `slaughter.controller.ts`, `slaughter.service.ts`, `slaughter.module.ts`.
- `backend/src/common/enums/` : `slaughter-type.enum.ts`, `slaughter-status.enum.ts`, `slaughter-destination.enum.ts`.
- `backend/src/modules/batches/` : rien à casser — on lie par `batchId` (FK).
- `backend/src/database/database-seed.service.ts` : constante `abattoir_reference_prefix`.
- `backend/src/app.module.ts` : enregistrer `SlaughterModule`.
- Génération PDF bordereau : bibliothèque simple côté backend (ex. `pdfmake`) — choix d'implémentation futur.
- Tests e2e : `backend/test/slaughter.e2e-spec.ts`.

## 6. Ordre d'implémentation (quand on décidera de le faire)

1. Enums + entité `SlaughterOrder` (+ FK batch).
2. DTOs + service (génération `referenceNumber`, logique interne/externe).
3. Controller (routes ci-dessus) + `SlaughterModule`.
4. Génération bordereau (PDF simple) pour EXTERNE.
5. Seed constante préfixe.
6. Tests e2e + mise à jour AGENTS.md.

## À valider quand on implémentera

1. `batchId` requis à la création, ou autoriser un ordre draft sans lot (_recommandé : requis_).
2. `totalWeightKg` utile dès v1 ou délégué au Market.
3. PDF bordereau dès v1, ou simple fiche imprimable (texte/HTML) au départ.
