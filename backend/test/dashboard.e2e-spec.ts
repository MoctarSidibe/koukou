import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function mondayOfCurrentWeek(): string {
  const now = new Date();
  const dow = (now.getUTCDay() + 6) % 7;
  const ws = new Date(now);
  ws.setUTCHours(12, 0, 0, 0);
  ws.setUTCDate(ws.getUTCDate() - dow);
  return ws.toISOString().slice(0, 10);
}

describe('Tableau de bord & courbes de croissance (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let token: string;
  let otherToken: string;
  let farmId: string;
  let batchId: string;

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

    const email = `owner.dash.${Date.now()}@e2e.ga`;
    await request(server)
      .post('/auth/register')
      .send({
        phone: `+24164${Date.now()}`,
        email,
        password: 'secret123',
        fullName: 'Proprio Dashboard',
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
        name: `Ferme Dashboard ${Date.now()}`,
        administrativeCity: 'Libreville',
        capacityPerBuilding: 3000,
      })
      .expect(201);
    farmId = farm.body.id;

    const otherEmail = `other.dash.${Date.now()}@e2e.ga`;
    await request(server)
      .post('/auth/register')
      .send({
        phone: `+24165${Date.now()}`,
        email: otherEmail,
        password: 'secret123',
        fullName: 'Autre Proprio Dashboard',
      })
      .expect(201);
    const otherLogin = await request(server)
      .post('/auth/login')
      .send({ identifier: otherEmail, password: 'secret123' })
      .expect(201);
    otherToken = otherLogin.body.accessToken;

    const batch = await request(server)
      .post(`/farms/${farmId}/batches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchName: 'Bande chair dashboard',
        integrationDate: today(),
        quantityAtStart: 100,
        type: 'CHAIR',
      })
      .expect(201);
    batchId = batch.body.id;
  });

  it('saisies journalières (morts, aliments, poids) + lot de provende au stock', async () => {
    const postEntry = (entryDate: string) =>
      request(server)
        .post(`/farms/${farmId}/batches/${batchId}/daily-entries`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          entryDate,
          deaths: 1,
          feedQuantity: 10,
          feedUnit: 'KG',
          feedType: 'DEMARRAGE',
          avgWeightKg: 0.5,
        })
        .expect(201);
    await postEntry(dateStr(addDays(new Date(), -1)));
    await postEntry(today());

    await request(server)
      .post(`/farms/${farmId}/inputs`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        kind: 'ALIMENT',
        foodType: 'DEMARRAGE',
        productName: 'Provende Démarrage',
        supplier: 'CEAG',
        supplierLotNumber: 'LOT-DASH-001',
        quantity: 5,
        unit: 'SAC',
      })
      .expect(201);
  });

  it('dashboard : cheptel vivant, mortalité/viabilité, autonomie provende, encaissé du jour', async () => {
    const res = await request(server)
      .get(`/farms/${farmId}/dashboard`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = res.body;
    expect(body.farmId).toBe(farmId);
    expect(typeof body.generatedAt).toBe('string');
    expect(body.liveStock).toBe(98);
    expect(body.batches).toEqual({
      total: 1,
      actif: 1,
      enVente: 0,
      cloture: 0,
    });
    expect(body.mortalityPercent).toBe(2);
    expect(body.viabilityPercent).toBe(98);
    expect(body.feedAutonomyDays).toBe(25);
    expect(body.collectedTodayFcfa).toBe(0);
    expect(body.teamCount).toBe(0);
    expect(body.alerts.rouge + body.alerts.jaune + body.alerts.vert).toBe(
      body.alerts.total,
    );
  });

  it('courbe : série hebdo poids moyen, aliments et IC cumulé', async () => {
    const res = await request(server)
      .get(`/farms/${farmId}/batches/${batchId}/curve`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = res.body;
    expect(body.batchId).toBe(batchId);
    expect(body.liveCount).toBe(98);
    expect(body.startWeightKg).toBe(0.045);
    expect(body.weekly).toHaveLength(1);
    const week = body.weekly[0];
    expect(week.weekStart).toBe(mondayOfCurrentWeek());
    expect(week.avgWeightKg).toBe(0.5);
    expect(week.feedKg).toBe(20);
    expect(week.deaths).toBe(2);
    expect(week.cumFeedKg).toBe(20);
    expect(week.fcrCumulative).toBe(0.45);
  });

  it('dashboard : encaissé du jour après vente POS payée en espèces', async () => {
    await request(server)
      .post(`/farms/${farmId}/caisse/open`)
      .set('Authorization', `Bearer ${token}`)
      .send({ openingBalanceFcfa: 0 })
      .expect(201);

    const sale = await request(server)
      .post(`/farms/${farmId}/sales`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          {
            productType: 'POULET_PIECE',
            batchId,
            quantity: 2,
            unitPriceFcfa: 1000,
          },
        ],
        payments: [{ method: 'CASH', amountFcfa: 2000 }],
      })
      .expect(201);
    expect(sale.body.sale).toBeTruthy();

    const res = await request(server)
      .get(`/farms/${farmId}/dashboard`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.collectedTodayFcfa).toBe(2000);
    expect(res.body.liveStock).toBe(96);
  });

  it('vigueur quotidienne : score 100 sain, alerte saisie manquée levée puis résolue, palmarès et écarts', async () => {
    const healthy = await request(server)
      .get(`/farms/${farmId}/dashboard`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(healthy.body.health.breakdown).toEqual({
      rouge: 0,
      jaune: 1,
      saisiesManquantes: 0,
    });
    expect(healthy.body.health.grade).toBe('EXCELLENT');
    const healthyScore = healthy.body.health.score;
    expect(healthyScore).toBe(95);
    expect(healthy.body.leaderboard).toHaveLength(1);
    expect(healthy.body.leaderboard[0].batchId).toBe(batchId);
    expect(healthy.body.leaderboard[0].status).toBe('ACTIF');
    expect(
      typeof healthy.body.leaderboard[0].perfIndex === 'number' ||
        healthy.body.leaderboard[0].perfIndex === null,
    ).toBe(true);
    expect(
      healthy.body.deltas.feedThisWeekKg + healthy.body.deltas.feedPrevWeekKg,
    ).toBe(20);
    expect(
      healthy.body.deltas.mortalityThisWeek +
        healthy.body.deltas.mortalityPrevWeek,
    ).toBe(2);
    expect(healthy.body.deltas.layRateDeltaPct).toBeNull();

    const batch2 = await request(server)
      .post(`/farms/${farmId}/batches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchName: 'Bande sans saisie',
        integrationDate: today(),
        quantityAtStart: 50,
        type: 'PONDEUSE',
      })
      .expect(201);

    const penalized = await request(server)
      .get(`/farms/${farmId}/dashboard`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(penalized.body.health.breakdown).toEqual({
      rouge: 0,
      jaune: 1,
      saisiesManquantes: 1,
    });
    expect(penalized.body.health.score).toBe(healthyScore - 10);
    expect(penalized.body.health.grade).toBe('EXCELLENT');
    expect(penalized.body.leaderboard).toHaveLength(2);

    const alerts = await request(server)
      .get(`/farms/${farmId}/alerts`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const saisie = alerts.body.find(
      (a: { kind: string; status: string }) =>
        a.kind === 'SAISIE_MANQUEE' && a.status === 'ACTIVE',
    );
    expect(saisie).toBeTruthy();
    expect(saisie.batchId).toBeNull();
    expect(saisie.level).toBe('JAUNE');

    await request(server)
      .post(`/farms/${farmId}/batches/${batch2.body.id}/daily-entries`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        entryDate: today(),
        deaths: 0,
        feedQuantity: 5,
        feedUnit: 'KG',
        feedType: 'FINITION',
        eggsCollected: 10,
      })
      .expect(201);

    const resolved = await request(server)
      .get(`/farms/${farmId}/dashboard`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(resolved.body.health.breakdown.saisiesManquantes).toBe(0);
    expect(resolved.body.health.score).toBe(healthyScore);
    const alertsAfter = await request(server)
      .get(`/farms/${farmId}/alerts`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      alertsAfter.body.find(
        (a: { kind: string; status: string }) =>
          a.kind === 'SAISIE_MANQUEE' && a.status === 'ACTIVE',
      ),
    ).toBeFalsy();
  });

  it('accès : lot introuvable → 404 ; autre ferme → 403', async () => {
    await request(server)
      .get(
        `/farms/${farmId}/batches/00000000-0000-4000-8000-000000000000/curve`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(server)
      .get(`/farms/${farmId}/dashboard`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
    await request(server)
      .get(`/farms/${farmId}/batches/${batchId}/curve`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });
});
