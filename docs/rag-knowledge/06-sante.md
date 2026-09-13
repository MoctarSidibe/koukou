# Santé, ambiance et biosécurité

## Signaux combinés (l'eau d'abord)

1. **Baisse d'eau > 10 %** → première alarme (voir `01-eau.md`).
2. **Baisse d'eau + mortalité en hausse** → alerte **MALADIE**
   (`evaluateWaterHealth`) : JAUNE dès (eau > 10 % ET mortalité > 1 %),
   ROUGE si l'un des deux signaux est critique. Vétérinaire + vérification
   abreuvement/alimentation/biosécurité.

## Stress thermique

- En zone humide et chaude (Gabon), le **THI** (Temperature Humidity Index)
  est suivi via les observations météo rapportées au module `weather` :
  au-delà du seuil, alerte de stress thermique.
- Conséquences : chute d'ingéré (et donc de poids/ponte), sur-consommation
  d'eau, augmentation du ratio eau/aliment, mortalité par coup de chaleur la
  nuit. Réponse : ventilation, eau fraîche abondante, réduire la densité,
  alimentation tôt le matin / tard le soir.

## Densité

- Bâtiment : seuil **JAUNE = 15 oiseaux/m²**, **ROUGE = 18 oiseaux/m²**
  (densité cumulée de TOUS les lots actifs du bâtiment).
- Lot seul : mêmes seuils (`DENSITY_WARN`/`DENSITY_CRITICAL` = 15/18).
- Surdensité → stress thermique, litière humide, mortalité. Recommandations :
  réduire le cheptel ou augmenter la surface, éclaircir, surveiller
  ventilation et litière.

## Cohabitation d'âges

- Écart d'âge entre bandes d'un même bâtiment **> 4 semaines**
  (`AGE_GAP_MAX_WEEKS`) = alerte. ROUGE si un **poussin ≤ 3 semaines** côtoie
  une bande mature (transmission virale). Consigne : planifier un vide
  sanitaire et séparer les lots si possible.

## Vide sanitaire

- Après clôture d'un lot : **14 à 21 jours** de vide (`VIDE_SANITAIRE_MIN_DAYS`
  = 14, `VIDE_SANITAIRE_MAX_DAYS` = 21).
- < 14 jours → ROUGE (réintroduction trop rapide) ; entre 14 et 21 → JAUNE
  (vide en cours). Nettoyer et désinfecter intégralement (litière, murs,
  abreuvoirs, mangeoires).

## Biosécurité & traçabilité

- **Traçabilité HACCP exigée** : provenance des poussins (couvoir, n° de lot,
  date d'éclosion) obligatoire dès la mise en vente ou la clôture → sinon
  alerte ROUGE `TRACABILITE` (exigence gouvernementale).
- Péremption `PEREMPTION` (intrants) : périmé → ROUGE (retrait du stock) ;
  expiration ≤ 7 j → ROUGE ; 8–14 j → JAUNE. Toujours en dates UTC.
- Prophylaxie de rattrapage (`PROPHYLAXIE`) : ROUGE si un soin est en retard,
  JAUNE si la prochaine séance est dans la fenêtre (≤ `calendar_lead_days`).
- Le module `sanitary` gère protocoles, prophylaxie, traitements, événements
  de santé (REFORME/MORTALITE décrémentent le cheptel immédiatement).

## Philosophie

Tout est **advisory** : même HACCP/sanitaire lèvent une alerte +
recommandation + trace, jamais un blocage — sauf envoi d'abattage si délai
d'attente sanitaire actif ou prophylaxie ROUGE (400). L'éleveur garde la main.