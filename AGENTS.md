# KouKou Ferme — Project Overview

## Project
Application mobile de gestion avicole **offline-first** pour le Gabon (SaaS, mobile-only, pas de web).
Nom de l'app : **KouKou Ferme** (renommé de "Kuku-Ferme"). Fourni comme spawn/partie du projet plus large de Doc 2.

Source de référence : **Gabon avicoles 2.docx** (CDCF mis à jour) — focus **Module 1 : Gestion des Lots (Suivi Technique Zootechnique)**.

## Stack
- **Backend :** NestJS + TypeORM + PostgreSQL/PostGIS + Swagger (`backend/`)
- **Mobile :** React Native (à venir, later phase) (`mobile/`)
- **Tests :** Vitest + supertest (défaut du CLI NestJS 12; utilise Vitest, pas Jest)

## Convention de langue
- **UI / messages utilisateur / erreurs / alertes / conseils : en FRANÇAIS**
- **Identifiants de code (variables, tables DB, fonctions) : en ANGLAIS**

## Rôles (no Agronome role)
- **Propriétaire** : voit tout, incluant les métriques de chaque Éleveur, IPE/GMQ, etc.
- **Éleveur** : compte lié à une ferme, saisie terrain, accès restreint (pas d'accès aux vues Propriétaire).
- Tab switch Propriétaire/Éleveur = préoccupation mobile (later phase).

## Module 1 — Scope verrouillé
- **Création de lot :** date arrivée, quantité poussins, souche, **type mutable** (CHAIR | PONDEUSE, transitions loguées dans `type_history`).
- **Unité modulaire** : référence = **3 000** (standard officiel POUFA), **advisory uniquement** (jamais de blocage). Ferme déclare sa propre capacité.
- **Saisie journalière ouvrier :** morts, aliments (**sacs OU kg**, converti à kg — sac par défaut 50 kg, configurable), eau (L), poids moyen hebdo.
- **Métriques Propriétaire (calcule serveur) :** IC, taux mortalité, viabilité, GMQ, IPE, taux de ponte.
- **Suivi ponte :** œufs/jour, tri (commercialisables / fêlés / petits), taux de ponte.
- **Traçabilité HACCP (exigence gouvernementale) :** origine poussins (couvoir, n° lot, date éclosion) + aliment de démarrage (`InputLot` fournisseur, n° lot, péremption), **optionnels à la création, modifiables**. **Depuis v2 : alerte ROUGE + conseil + tracé, PAS de blocage** (aligné sur la philosophie advisory).
- **Bâtiments (`Building`) :** chaque ferme a des bâtiments (nom, surface m², capacité, dernier vide sanitaire). Un lot est rattaché à un bâtiment (`buildingId`). Plusieurs lots (bandes) peuvent occuper un bâtiment.
- **Densité par lot :** bande 12–15 oiseaux/m², alerte >15, critique >18.
- **Densité au niveau BÂTIMENT (`DENSITE_BATIMENT`) :** somme des oiseaux vivants des lots actifs du bâtiment / surface → alerte >15, critique >18 (constants `building_density_*`).
- **Cohabitation d'âges (`COHABITATION`) :** écart d'âge max entre bandes cohabitantes = 4 semaines (`age_gap_max_weeks`). Poussin <3 semaines cohabitant avec bande mature → ROUGE.
- **Vide sanitaire (`VIDE_SANITAIRE`) :** fenêtre 14–21 jours (`vide_sanitaire_min/max_days`) modifiable en réglages. **Alerte ROUGE + conseil, PAS de blocage** ; reste tracée dans l'historique.

## Assistant & Alertes (built into MVP)
- Engin d'alertes par **règles** (rule registry), réutilisable pour les Modules 2-6.
- Alertes persistées, **messages FRANÇAIS**, statut couleur (vert/jaune/rouge), recommandations.
- Eau = indicateur radar n°1 des maladies → alerte jaune sur baisse. Aussi : baisse aliment, pic mortalité, surdensité, densité bâtiment, cohabitation d'âges, vide sanitaire, déviation IPE/GMQ, **péremption (HACCP)**, traçabilité incomplète.
- **Cycle de vie alerte :** `ACTIVE` → `RESOLUE` (avec `resolvedAt`) quand le risque disparaît ; l'alerte reste dans l'**historique** et dans **les rapports 360° du fermier** (`GET /farms/:farmId/alerts/history`). **Tout est tracé.**
- **Philosophie : advisory uniquement, JAMAIS de blocage** (y compris vide sanitaire et traçabilité HACCP) — alerte ROUGE + conseil + traçage, le fermier garde le contrôle.
- Backend émet des événements d'alerte ; notifications push/locales = phase mobile.

## Décisions / conventions
- Semences : souches — Chair : Cobb 500, Hubbard, Ross 308 · Pondeuses : ISA Brown, Lohmann Brown (+ ajout custom).
- Semences constants : `standard_module`=3000, densité warn 15 / critical 18, vide sanitaire 14–21 j, écart d'âge 4 sem., `building_density_*`.
- **Blocage logiciel retiré** au profit d'alertes ROUGE + conseil + historique (vide sanitaire, HACCP). L'utilisateur reste décisionnaire avec une visibilité 360°.
- FinTech / Mobile Money (escrow) : **déféré** (phase ultérieure).
- Repo : monorepo `backend/` + `mobile/` (+ `docs/`). Repo GitHub : https://github.com/MoctarSidibe/koukou
