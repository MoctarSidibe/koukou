import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

describe('Module 3 — Stocks & Inventaire provende (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let token: string;
  let otherToken: string;
  let farmId: string;
  let otherFarmId: string;
  let lotAId: string;
  let foreignLotId: string;

  async function createBatch(integrationDate: string) {
    const res = await request(server)
      .post(`/farms/${farmId}/batches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchName: `Lot Stock ${Date.now()}`,
        integrationDate,
        quantityAtStart: 300,
        type: 'CHAIR',
      })
      .expect(201);
    return res.body.id;
  }

  async function addDailyEntry(
    batchId: string,
    date: string,
    inputLotId?: string,
  ) {
    return request(server)
      .post(`/farms/${farmId}/batches/${batchId}/daily-entries`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        entryDate: date,
        feedQuantity: 40,
        feedUnit: 'KG',
        feedType: 'DEMARRAGE',
        ...(inputLotId ? { inputLotId } : {}),
      })
      .expect(201);
  }

  async function addInput(
    supplierLotNumber: string,
    quantity: number,
    unit = 'SAC',
  ) {
    const res = await request(server)
      .post(`/farms/${farmId}/inputs`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        kind: 'ALIMENT',
        foodType: 'DEMARRAGE',
        productName: `Provende Démarrage ${supplierLotNumber}`,
        supplier: 'CEAG',
        supplierLotNumber,
        quantity,
        unit,
      })
      .expect(201);
    return res.body.id;
  }

  async function activeAlimentAlert() {
    const res = await request(server)
      .get(`/farms/${farmId}/alerts`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body.find(
      (a: any) =>
        a.kind === 'ALIMENT' &&
        a.status === 'ACTIVE' &&
        !a.batchId &&
        !a.buildingId,
    );
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    server = app.getHttpServer();

    const email = `owner.stock.${Date.now()}@e2e.ga`;
    await request(server)
      .post('/auth/register')
      .send({
        phone: `+24180${Date.now()}`,
        email,
        password: 'secret123',
        fullName: 'Proprio Stock',
      })
      .expect(201);
    const login = await request(server)
      .post('/auth/login')
      .send({ identifier: email, password: 'secret123' })
      .expect(201);
    token = login.body.accessToken;

    const farm = await request(server)
      .post('/farms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Ferme Stock ${Date.now()}`,
        administrativeCity: 'Franceville',
        capacityPerBuilding: 1000,
      })
      .expect(201);
    farmId = farm.body.id;

    // Propriétaire tiers + ferme tierce pour les contrôles d'accès / lot étranger.
    const otherEmail = `other.stock.${Date.now()}@e2e.ga`;
    await request(server)
      .post('/auth/register')
      .send({
        phone: `+24181${Date.now()}`,
        email: otherEmail,
        password: 'secret123',
        fullName: 'Autre Proprio',
      })
      .expect(201);
    const otherLogin = await request(server)
      .post('/auth/login')
      .send({ identifier: otherEmail, password: 'secret123' })
      .expect(201);
    otherToken = otherLogin.body.accessToken;

    const otherFarm = await request(server)
      .post('/farms')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        name: `Ferme Tiers ${Date.now()}`,
        administrativeCity: 'Kango',
        capacityPerBuilding: 1000,
      })
      .expect(201);
    otherFarmId = otherFarm.body.id;

    const foreignLot = await request(server)
      .post(`/farms/${otherFarmId}/inputs`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        kind: 'ALIMENT',
        foodType: 'DEMARRAGE',
        productName: 'Provende Tiers',
        supplier: 'CEAG',
        supplierLotNumber: 'TIERS-1',
        quantity: 10,
        unit: 'SAC',
      })
      .expect(201);
    foreignLotId = foreignLot.body.id;
  });

  it('sans stock ni saisies : résumé vide et aucune alerte ALIMENT', async () => {
    const res = await request(server)
      .get(`/farms/${farmId}/feed-stock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.byType).toEqual([]);
    const alert = await activeAlimentAlert();
    expect(alert).toBeUndefined();
  });

  it('3 saisies de 40 kg (Démarrage) + 2 sacs de stock → alerte ALIMENT ROUGE (< 3 jours d’autonomie)', async () => {
    const batchId = await createBatch(daysAgo(3));
    for (const n of [2, 1, 0]) {
      await addDailyEntry(batchId, daysAgo(n));
    }

    lotAId = await addInput('DEMA-100', 2); // 2 sacs = 100 kg

    const res = await request(server)
      .get(`/farms/${farmId}/feed-stock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const dem = res.body.byType.find((t: any) => t.foodType === 'DEMARRAGE');
    expect(dem).toBeTruthy();
    expect(dem.receivedKg).toBe(100);
    expect(dem.availableKg).toBe(100);
    expect(dem.autonomyDays).toBeCloseTo(2.5, 1);

    const alert = await activeAlimentAlert();
    expect(alert).toBeTruthy();
    expect(alert.level).toBe('ROUGE');
    expect(alert.message).toContain('Démarrage');
  });

  it('réapprovisionnement ramène l’autonomie au-dessus des 5 jours → alerte résolue', async () => {
    await addInput('DEMA-120', 2, 'SAC'); // total : 200 kg
    const res = await request(server)
      .get(`/farms/${farmId}/feed-stock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const dem = res.body.byType.find((t: any) => t.foodType === 'DEMARRAGE');
    expect(dem.autonomyDays).toBeCloseTo(5, 1);
    expect(dem.status).toBe('VERT');

    const alert = await activeAlimentAlert();
    expect(alert).toBeUndefined();
  });

  it('déclare 1 sac gâté (50 kg) → autonomie 3.75 j → alerte JAUNE', async () => {
    await request(server)
      .post(`/farms/${farmId}/feed-stock/losses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        inputLotId: lotAId,
        quantity: 1,
        reason: 'HUMIDITE',
        notes: 'Sac humide au stockage',
      })
      .expect(201);

    const res = await request(server)
      .get(`/farms/${farmId}/feed-stock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const dem = res.body.byType.find((t: any) => t.foodType === 'DEMARRAGE');
    expect(dem.availableKg).toBe(150);
    expect(dem.autonomyDays).toBeCloseTo(3.75, 1);
    expect(dem.status).toBe('JAUNE');

    const alert = await activeAlimentAlert();
    expect(alert).toBeTruthy();
    expect(alert.level).toBe('JAUNE');
  });

  it('une 2e perte de 50 kg fait repasser le stock sous le seuil critique (ROUGE)', async () => {
    await request(server)
      .post(`/farms/${farmId}/feed-stock/losses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        inputLotId: lotAId,
        quantity: 1,
        unit: 'SAC',
        reason: 'RONGEURS',
      })
      .expect(201);

    const res = await request(server)
      .get(`/farms/${farmId}/feed-stock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const dem = res.body.byType.find((t: any) => t.foodType === 'DEMARRAGE');
    expect(dem.availableKg).toBe(100);

    const alert = await activeAlimentAlert();
    expect(alert).toBeTruthy();
    expect(alert.level).toBe('ROUGE');

    const lotA = res.body.lots.find((l: any) => l.id === lotAId);
    expect(lotA.lostKg).toBe(100);
    expect(lotA.availableKg).toBe(0);
  });

  it('saisie liée à un lot (HACCP) décrémente le stock du lot et trace le mouvement', async () => {
    const batch2 = await createBatch(daysAgo(1));
    await addDailyEntry(batch2, daysAgo(3), lotAId);

    const res = await request(server)
      .get(`/farms/${farmId}/feed-stock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lotA = res.body.lots.find((l: any) => l.id === lotAId);
    expect(lotA.usedKg).toBe(40);
    expect(lotA.availableKg).toBe(0); // 100 reçus − 100 perdus − 40 consommés (plafonné)

    const mov = await request(server)
      .get(`/farms/${farmId}/feed-stock/movements`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const conso = mov.body.find(
      (m: any) => m.type === 'CONSOMMATION' && m.inputLotId === lotAId,
    );
    expect(conso).toBeTruthy();
    expect(conso.quantityKg).toBe(40);

    const pertes = await request(server)
      .get(`/farms/${farmId}/feed-stock/losses`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(pertes.body.length).toBe(2);
    expect(pertes.body.every((p: any) => p.quantityKg === 50)).toBe(true);
  });

  it('perte déclarée sur un lot d’une autre ferme → 400', async () => {
    await request(server)
      .post(`/farms/${farmId}/feed-stock/losses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ inputLotId: foreignLotId, quantity: 1, reason: 'AUTRE' })
      .expect(400);
  });

  it("l'inventaire d'une ferme n'appartenant pas à l'utilisateur → 403", async () => {
    await request(server)
      .get(`/farms/${farmId}/feed-stock`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});
