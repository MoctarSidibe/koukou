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
- **Traçabilité HACCP (exigence gouvernementale) :** origine poussins (couvoir, n° lot, date éclosion) + aliment de démarrage (`InputLot` fournisseur, n° lot, péremption), **optionnels à la création, modifiables**, **requis avant vente** (blocage vente si incomplet).
- **Densité :** bande 12–15 oiseaux/m² (Gabon-tropical), alerte >15, critique >18 — constantes DB éditables (admin dashboard plus tard).

## Assistant & Alertes (built into MVP)
- Engin d'alertes par **règles** (rule registry), réutilisable pour les Modules 2-6.
- Alertes persistées, **messages FRANÇAIS**, statut couleur (vert/jaune/rouge), recommandations.
- Eau = indicateur radar n°1 des maladies → alerte jaune sur baisse. Aussi : baisse aliment, pic mortalité, surdensité, déviation IPE/GMQ, **péremption (HACCP)**, traçabilité incomplète avant vente.
- Backend émet des événements d'alerte ; notifications push/locales = phase mobile.

## Décisions / conventions
- Semences : souches — Chair : Cobb 500, Hubbard, Ross 308 · Pondeuses : ISA Brown, Lohmann Brown (+ ajout custom).
- Semences constants : `standard_module`=3000, densité warn 15 / critical 18.
- Aucun blocage "métier" sauf prérequis légal de vente (traçabilité HACCP).
- FinTech / Mobile Money (escrow) : **déféré** (phase ultérieure).
- Repo : monorepo `backend/` + `mobile/` (+ `docs/`). Repo GitHub : https://github.com/MoctarSidibe/koukou
