import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';

describe('Plateforme — Administration (rôle PLATFORM_ADMIN, métriques, fermes, utilisateurs, config), e2e', () => {
  let app: INestApplication<App>;
  let server: App;
  let adminToken: string;
  let ownerToken: string;
  let farmId: string;
  let secondaryUserId: string;
  let breedId: string;
  let protocolId: string;

  const stamp = Date.now();

  function post(url: string, body: object, auth = adminToken) {
    return request(server)
      .post(url)
      .set('Authorization', `Bearer ${auth}`)
      .send(body);
  }

  function get(url: string, auth = adminToken) {
    return request(server).get(url).set('Authorization', `Bearer ${auth}`);
  }

  function patch(url: string, body: object, auth = adminToken) {
    return request(server)
      .patch(url)
      .set('Authorization', `Bearer ${auth}`)
      .send(body);
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

    // Propriétaire + ferme + lot + caisse pour alimenter les métriques.
    const ownerEmail = `owner.plat.${stamp}@e2e.ga`;
    await request(server)
      .post('/auth/register')
      .send({
        phone: `+24160${stamp}`,
        email: ownerEmail,
        password: 'secret123',
        fullName: 'Propriétaire Plateforme',
      })
      .expect(201);
    const ownerLogin = await request(server)
      .post('/auth/login')
      .send({ identifier: ownerEmail, password: 'secret123' })
      .expect(201);
    ownerToken = ownerLogin.body.accessToken;

    const farm = await post(
      '/farms',
      { name: `Ferme Plateforme ${stamp}`, administrativeCity: 'Libreville' },
      ownerToken,
    ).expect(201);
    farmId = farm.body.id;

    await post(
      `/farms/${farmId}/caisse/open`,
      { openingBalanceFcfa: 5000 },
      ownerToken,
    ).expect(201);

    await post(
      `/farms/${farmId}/sales`,
      {
        items: [
          {
            productType: 'AUTRE',
            quantity: 1,
            unit: 'UNITE',
            unitPriceFcfa: 4500,
          },
        ],
        payments: [{ method: 'CASH', amountFcfa: 4500 }],
      },
      ownerToken,
    ).expect(201);

    // Compte secondaire (sera suspendu) + promotion du rôle en administrateur.
    const secondaryEmail = `secondary.plat.${stamp}@e2e.ga`;
    await request(server)
      .post('/auth/register')
      .send({
        phone: `+24161${stamp}`,
        email: secondaryEmail,
        password: 'secret123',
        fullName: 'Compte Secondaire',
      })
      .expect(201);
    const secondary = await request(server)
      .post('/auth/login')
      .send({ identifier: secondaryEmail, password: 'secret123' })
      .expect(201);
    secondaryUserId = secondary.body.user.id;

    const adminEmail = `admin.plat.${stamp}@e2e.ga`;
    await request(server)
      .post('/auth/register')
      .send({
        phone: `+24162${stamp}`,
        email: adminEmail,
        password: 'secret456',
        fullName: 'Administrateur Plateforme',
      })
      .expect(201);
    const ds = app.get(DataSource);
    await ds.query(
      `UPDATE users SET role = 'PLATFORM_ADMIN' WHERE email = $1`,
      [adminEmail],
    );
    const adminLogin = await request(server)
      .post('/auth/login')
      .send({ identifier: adminEmail, password: 'secret456' })
      .expect(201);
    adminToken = adminLogin.body.accessToken;
    expect(adminLogin.body.user.role).toBe('PLATFORM_ADMIN');
  });

  afterAll(async () => {
    // Rétablit l’état canonique des méthodes de paiement (disponible = CASH)
    // pour ne pas importer l’état global pollué aux autres specs.
    await patch('/admin/payment-methods/MOBILE_MONEY', { enabled: false })
      .then((r) => r.status === 200)
      .catch(() => undefined);
    await patch('/admin/payment-methods/QR_CODE', { enabled: false })
      .then((r) => r.status === 200)
      .catch(() => undefined);
    await app.close();
  });

  it('refuse l’accès administration à un Propriétaire (403)', async () => {
    await get('/admin/farms', ownerToken).expect(403);
    await get('/admin/users', ownerToken).expect(403);
    await get('/admin/metrics', ownerToken).expect(403);
    await get('/admin/rules', ownerToken).expect(403);
    await patch(
      '/admin/farms/00000000-0000-0000-0000-000000000000',
      {},
      ownerToken,
    ).expect(403);
  });

  it('liste toutes les fermes avec le propriétaire', async () => {
    const res = await get('/admin/farms').expect(200);
    const mine = res.body.find((f: any) => f.id === farmId);
    expect(mine).toBeDefined();
    expect(mine.active).toBe(true);
    expect(mine.owner).toBeDefined();
    expect(mine.owner.fullName).toBe('Propriétaire Plateforme');
    expect(mine.passwordHash).toBeUndefined();
  });

  it('calcule les métriques plateforme', async () => {
    const res = await get('/admin/metrics').expect(200);
    const b = res.body;
    expect(b.farms.total).toBeGreaterThanOrEqual(1);
    expect(b.farms.active).toBeGreaterThanOrEqual(1);
    expect(b.sales.count).toBeGreaterThanOrEqual(1);
    expect(b.sales.revenueFcfa).toBeGreaterThanOrEqual(4500);
    expect(b.paidFcfa).toBeGreaterThanOrEqual(4500);
    expect(b.users.total).toBeGreaterThanOrEqual(3);
    const roles = b.users.byRole.map((r: any) => r.role);
    expect(roles).toContain('PLATFORM_ADMIN');
    expect(roles).toContain('PROPRIETAIRE');
    expect(b.period.from).toBeNull();
  });

  it('filtre les métriques par période et expose le détail par ferme', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await get(`/admin/metrics?from=${today}&to=${today}`).expect(
      200,
    );
    expect(res.body.period.from).toBe(today);

    const byFarm = await get('/admin/metrics/by-farm').expect(200);
    const row = byFarm.body.find((r: any) => r.farm.id === farmId);
    expect(row).toBeDefined();
    expect(row.sales.revenueFcfa).toBeGreaterThanOrEqual(4500);
    expect(row.owner.fullName).toBe('Propriétaire Plateforme');
  });

  it('liste les utilisateurs sans mot de passe', async () => {
    const res = await get('/admin/users').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    res.body.forEach((u: any) => {
      expect(u.passwordHash).toBeUndefined();
    });
    expect(res.body.some((u: any) => u.role === 'PLATFORM_ADMIN')).toBe(true);
  });

  it('suspend un utilisateur : login refusé, puis réactive', async () => {
    await patch(`/admin/users/${secondaryUserId}/suspend`, {
      suspended: true,
    }).expect(200);
    const blocked = await request(server)
      .post('/auth/login')
      .send({
        identifier: `secondary.plat.${stamp}@e2e.ga`,
        password: 'secret123',
      })
      .expect(401);
    expect(String(blocked.body.message)).toContain('suspendu');

    await patch(`/admin/users/${secondaryUserId}/suspend`, {
      suspended: false,
    }).expect(200);
    await request(server)
      .post('/auth/login')
      .send({
        identifier: `secondary.plat.${stamp}@e2e.ga`,
        password: 'secret123',
      })
      .expect(201);
  });

  it('interdit la suspension d’un administrateur plateforme', async () => {
    const users = await get('/admin/users').expect(200);
    const admin = users.body.find((u: any) => u.role === 'PLATFORM_ADMIN');
    await patch(`/admin/users/${admin.id}/suspend`, {
      suspended: true,
    }).expect(400);
  });

  it('liste les règles du registre', async () => {
    const res = await get('/admin/rules').expect(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('active/désactive une méthode de paiement (sauf espèces)', async () => {
    await patch('/admin/payment-methods/MOBILE_MONEY', {
      enabled: false,
    }).expect(200);
    const afterDisable = await patch('/admin/payment-methods/MOBILE_MONEY', {
      enabled: true,
    }).expect(200);
    expect(afterDisable.body.enabled).toBe(true);
    await patch('/admin/payment-methods/MOBILE_MONEY', {
      enabled: false,
    }).expect(200);

    await patch('/admin/payment-methods/CASH', { enabled: false }).expect(400);
  });

  it('modifie une souche et un protocole sanitaire', async () => {
    const breeds = await get('/breeds').expect(200);
    breedId = breeds.body[0].id;
    const updated = await patch(`/admin/breeds/${breedId}`, {
      active: false,
    }).expect(200);
    expect(updated.body.active).toBe(false);
    await patch(`/admin/breeds/${breedId}`, { active: true }).expect(200);

    const protocols = await get('/sanitary/protocols').expect(200);
    protocolId = protocols.body[0].id;
    const protoUpdate = await patch(`/admin/protocols/${protocolId}`, {
      name: `Protocole ${stamp}`,
    }).expect(200);
    expect(protoUpdate.body.isEditable).toBe(true);
  });

  it('suspend une ferme : lecture OK, nouvelle vente bloquée (400)', async () => {
    await patch(`/admin/farms/${farmId}`, { active: false }).expect(200);

    const farms = await get('/admin/farms').expect(200);
    expect(farms.body.find((f: any) => f.id === farmId).active).toBe(false);

    const blocked = await post(
      `/farms/${farmId}/sales`,
      {
        items: [
          {
            productType: 'AUTRE',
            quantity: 1,
            unit: 'UNITE',
            unitPriceFcfa: 100,
          },
        ],
        payments: [{ method: 'CASH', amountFcfa: 100 }],
      },
      ownerToken,
    ).expect(400);
    expect(String(blocked.body.message)).toContain('suspendue');

    await patch(`/admin/farms/${farmId}`, { active: true }).expect(200);
    await post(
      `/farms/${farmId}/sales`,
      {
        items: [
          {
            productType: 'AUTRE',
            quantity: 1,
            unit: 'UNITE',
            unitPriceFcfa: 100,
          },
        ],
        payments: [{ method: 'CASH', amountFcfa: 100 }],
      },
      ownerToken,
    ).expect(201);
  });

  it('provisionne une nouvelle ferme avec son propriétaire', async () => {
    const phone = `+24163${stamp}`;
    const email = `provisioned.plat.${stamp}@e2e.ga`;
    const res = await post('/admin/farms', {
      name: `Ferme Provisionnée ${stamp}`,
      administrativeCity: 'Port-Gentil',
      capacityPerBuilding: 800,
      owner: {
        fullName: 'Propriétaire Provisionné',
        phone,
        email,
        password: 'provision123',
      },
    }).expect(201);
    expect(res.body.farm.id).toBeDefined();
    expect(res.body.owner.fullName).toBe('Propriétaire Provisionné');

    const ownerLogin = await request(server)
      .post('/auth/login')
      .send({ identifier: email, password: 'provision123' })
      .expect(201);
    expect(ownerLogin.body.user.role).toBe('PROPRIETAIRE');

    await post('/admin/farms', {
      name: 'Doublon',
      administrativeCity: 'Libreville',
      owner: { fullName: 'Doublon', phone, password: 'provision123' },
    }).expect(409);

    // Le propriétaire provisionné accède bien à sa ferme.
    const farms = await request(server)
      .get('/farms')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .expect(200);
    const mine = farms.body.find((f: any) => f.id === res.body.farm.id);
    expect(mine).toBeDefined();
  });

  it('réserve la modification des constantes à l’administrateur plateforme', async () => {
    const before = await request(server)
      .get('/reference-constants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const target = before.body.find(
      (c: any) => c.key === 'customer_segment_top_min_visits',
    );
    expect(target).toBeDefined();

    await patch(
      '/reference-constants/customer_segment_top_min_visits',
      { value: 9 },
      ownerToken,
    ).expect(403);

    const adminPatch = await patch(
      '/reference-constants/customer_segment_top_min_visits',
      { value: 9 },
    ).expect(200);
    expect(adminPatch.body.value).toBe(9);

    // Rétablit la valeur semée pour ne pas impacter les autres specs.
    await patch('/reference-constants/customer_segment_top_min_visits', {
      value: 6,
    }).expect(200);
  });
});
