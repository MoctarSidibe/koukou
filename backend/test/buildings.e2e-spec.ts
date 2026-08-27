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

describe('Module 1 — Bâtiments & bandes (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let token: string;
  let farmId: string;
  let buildingA: string;
  let buildingB: string;

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
  });

  beforeAll(async () => {
    const phone = `+24180${Date.now()}`;
    const email = `owner.b.${Date.now()}@e2e.ga`;
    await request(server)
      .post('/auth/register')
      .send({
        phone,
        email,
        password: 'secret123',
        fullName: 'Proprio Bâtiments',
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
        name: `Ferme Bât ${Date.now()}`,
        administrativeCity: 'Libreville',
        capacityPerBuilding: 1500,
      })
      .expect(201);
    farmId = farm.body.id;
  });

  it('crée des bâtiments', async () => {
    const a = await request(server)
      .post(`/farms/${farmId}/buildings`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bâtiment A', buildingAreaM2: 30, capacity: 3000 })
      .expect(201);
    buildingA = a.body.id;

    const b = await request(server)
      .post(`/farms/${farmId}/buildings`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bâtiment B', buildingAreaM2: 40, capacity: 2000 })
      .expect(201);
    buildingB = b.body.id;
    expect(buildingA).toBeTruthy();
    expect(buildingB).toBeTruthy();
  });

  it('liste les bâtiments avec occupation (0 lot, densité nulle)', async () => {
    const res = await request(server)
      .get(`/farms/${farmId}/buildings`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.length).toBe(2);
    expect(res.body.every((x: any) => x.stats.activeBirds === 0)).toBe(true);
  });

  it('installe 2 lots décalés dans le Bâtiment A : densité cumulée + cohabitation d’âges', async () => {
    // Bande 1 : 40 jours (~5.7 semaines), 1500 oiseaux
    await request(server)
      .post(`/farms/${farmId}/batches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchName: 'Bande A1',
        integrationDate: daysAgo(40),
        quantityAtStart: 1500,
        type: 'CHAIR',
        buildingId: buildingA,
      })
      .expect(201);
    // Bande 2 : poussins de 2 jours, 800 oiseaux — écart d'âge ~5 semaines
    await request(server)
      .post(`/farms/${farmId}/batches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchName: 'Bande A2',
        integrationDate: daysAgo(2),
        quantityAtStart: 800,
        type: 'CHAIR',
        buildingId: buildingA,
      })
      .expect(201);

    // Densité cumulée au niveau bâtiment : (1500+800) / 30 = 76.7
    const building = await request(server)
      .get(`/farms/${farmId}/buildings/${buildingA}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(building.body.stats.activeBirds).toBe(2300);
    expect(building.body.stats.activeLots).toBe(2);
    expect(building.body.stats.densityPerM2).toBeCloseTo(2300 / 30, 1);

    const alerts = await request(server)
      .get(`/farms/${farmId}/alerts`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const dens = alerts.body.find((a: any) => a.kind === 'DENSITE_BATIMENT');
    const cohab = alerts.body.find((a: any) => a.kind === 'COHABITATION');
    expect(dens).toBeTruthy();
    expect(dens.level).toBe('ROUGE');
    expect(cohab).toBeTruthy();
    expect(cohab.level).toBe('ROUGE'); // un poussin fragile (< 3 semaines) cohabite avec une bande mature
    expect(dens.buildingId).toBe(buildingA);
  });

  it('lève une alerte VIDE SANITAIRE (ROUGE) si on réintroduit trop vite un bâtiment', async () => {
    // Bande dans Bâtiment B, clôturée immédiatement => vide sanitaire non respecté pour la suivante
    const b1 = await request(server)
      .post(`/farms/${farmId}/batches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchName: 'Bande B1',
        integrationDate: daysAgo(70),
        quantityAtStart: 500,
        type: 'CHAIR',
        buildingId: buildingB,
      })
      .expect(201);
    await request(server)
      .patch(`/farms/${farmId}/batches/${b1.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        couvoirSupplier: 'Couvoir',
        chickLotNumber: 'L1',
        hatchDate: daysAgo(70),
      })
      .expect(200);
    await request(server)
      .post(`/farms/${farmId}/batches/${b1.body.id}/cloture`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    // Nouvelle bande dans le même bâtiment, quasiment tout de suite
    await request(server)
      .post(`/farms/${farmId}/batches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchName: 'Bande B2',
        integrationDate: daysAgo(1),
        quantityAtStart: 600,
        type: 'CHAIR',
        buildingId: buildingB,
      })
      .expect(201);

    const alerts = await request(server)
      .get(`/farms/${farmId}/alerts/history`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const vs = alerts.body.find((a: any) => a.kind === 'VIDE_SANITAIRE');
    expect(vs).toBeTruthy();
    expect(vs.level).toBe('ROUGE');
  });

  afterAll(async () => {
    await app.close();
  });
});
