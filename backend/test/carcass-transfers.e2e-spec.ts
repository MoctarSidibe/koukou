import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('Carcasses — Transferts ferme → boutique (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let token: string;
  let otherToken: string;
  let farmId: string;
  let otherFarmId: string;
  let batchId: string;
  let slaughterOrderId: string;
  let fermePdvId: string;
  let boutiqueId: string;
  let transferId: string;
  let saleId: string;

  function post(url: string, body: object, auth = token) {
    return request(server).post(url).set('Authorization', `Bearer ${auth}`).send(body);
  }

  function get(url: string, auth = token) {
    return request(server).get(url).set('Authorization', `Bearer ${auth}`);
  }

  function del(url: string, auth = token) {
    return request(server).delete(url).set('Authorization', `Bearer ${auth}`);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    server = app.getHttpServer();

    const phone = `+24170${Date.now()}`;
    await request(server)
      .post('/auth/register')
      .send({ phone, fullName: 'Proprio Transferts', code: 'secret123' })
      .expect(201);
    const login = await request(server)
      .post('/auth/login')
      .send({ phone, code: 'secret123' })
      .expect(201);
    token = login.body.accessToken;

    const farm = await request(server)
      .post('/farms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Ferme Transferts ${Date.now()}`,
        administrativeCity: 'Libreville',
        capacityPerBuilding: 1000,
      })
      .expect(201);
    farmId = farm.body.id;

    const otherPhone = `+24171${Date.now()}`;
    await request(server)
      .post('/auth/register')
      .send({ phone: otherPhone, fullName: 'Autre Proprio', code: 'secret123' })
      .expect(201);
    const otherLogin = await request(server)
      .post('/auth/login')
      .send({ phone: otherPhone, code: 'secret123' })
      .expect(201);
    otherToken = otherLogin.body.accessToken;

    const otherFarm = await request(server)
      .post('/farms')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        name: `Autre Ferme ${Date.now()}`,
        administrativeCity: 'Libreville',
        capacityPerBuilding: 1000,
      })
      .expect(201);
    otherFarmId = otherFarm.body.id;

    const batch = await request(server)
      .post(`/farms/${farmId}/batches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchName: 'Lot carcasses',
        integrationDate: today(),
        quantityAtStart: 300,
        type: 'CHAIR',
        couvoirSupplier: 'Canabec',
        chickLotNumber: `CC-${Date.now()}`,
        hatchDate: today(),
      })
      .expect(201);
    batchId = batch.body.id;
  });

  it('liste des PDV : le « ferme » par défaut est créé automatiquement', async () => {
    const pdvs = await get(`/farms/${farmId}/points-of-sale`).expect(200);
    expect((pdvs.body as any[]).find((p) => p.kind === 'FERME' && p.isDefault)).toBeTruthy();
    fermePdvId = (pdvs.body as any[]).find((p) => p.kind === 'FERME')!.id;
  });

  it('création d’une boutique', async () => {
    const pos = await post(`/farms/${farmId}/points-of-sale`, {
      kind: 'BOUTIQUE',
      name: 'Boutique Akoa',
      city: 'Libreville',
    }).expect(201);
    expect(pos.body.kind).toBe('BOUTIQUE');
    boutiqueId = pos.body.id;
  });

  it('ordre ABATTU INTERNE traité : pool de carcasses = birdCount', async () => {
    const created = await post(`/farms/${farmId}/slaughter-orders`, {
      batchId,
      slaughterType: 'ABATTU',
      destination: 'INTERNE',
      plannedDate: today(),
      birdCount: 20,
    }).expect(201);
    slaughterOrderId = created.body.id;

    await post(`/farms/${farmId}/slaughter-orders/${slaughterOrderId}/send`, {}).expect(201);

    const processed = await post(`/farms/${farmId}/slaughter-orders/${slaughterOrderId}/process`, {}).expect(201);
    expect(processed.body.status).toBe('PROCESSED');
    expect(processed.body.carcassesAvailable).toBe(20);
  });

  it('transfert de 12 carcasses vers la boutique : pool ferme décrémenté', async () => {
    const res = await post(`/farms/${farmId}/carcass-transfers`, {
      slaughterOrderId,
      pointOfSaleId: boutiqueId,
      quantity: 12,
    }).expect(201);
    expect(res.body.quantity).toBe(12);
    expect(res.body.quantitySold).toBe(0);
    expect(res.body.status).toBe('TRANSFERRED');
    expect(res.body.batchId).toBe(batchId);
    transferId = res.body.id;

    const order = await get(`/farms/${farmId}/slaughter-orders/${slaughterOrderId}`).expect(200);
    expect(order.body.carcassesAvailable).toBe(8);
  });

  it('liste des transferts (filtrable par boutique) avec les relations', async () => {
    const all = await get(`/farms/${farmId}/carcass-transfers`).expect(200);
    expect((all.body as any[]).length).toBe(1);
    const byPdv = await get(`/farms/${farmId}/carcass-transfers?pointOfSaleId=${boutiqueId}`).expect(200);
    expect((byPdv.body as any[])[0].id).toBe(transferId);
    expect((byPdv.body as any[])[0].pointOfSale.id).toBe(boutiqueId);
    expect((byPdv.body as any[])[0].slaughterOrder.id).toBe(slaughterOrderId);
  });

  it('transfert supérieur au pool : 400', async () => {
    const res = await post(`/farms/${farmId}/carcass-transfers`, {
      slaughterOrderId,
      pointOfSaleId: boutiqueId,
      quantity: 100,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Carcasses insuffisantes');
  });

  it('transfert vers la ferme (PDV par défaut) : 400', async () => {
    const res = await post(`/farms/${farmId}/carcass-transfers`, {
      slaughterOrderId,
      pointOfSaleId: fermePdvId,
      quantity: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('boutique');
  });

  it('transfert vers une boutique d’une autre ferme : 400', async () => {
    const otherPdv = await request(server)
      .post(`/farms/${otherFarmId}/points-of-sale`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ kind: 'BOUTIQUE', name: 'Boutique autre' })
      .expect(201);
    const res = await post(`/farms/${farmId}/carcass-transfers`, {
      slaughterOrderId,
      pointOfSaleId: otherPdv.body.id,
      quantity: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('introuvable');
  });

  it('vente ABATTU en boutique : consomme le transfert, pas le pool ferme', async () => {
    await post(`/farms/${farmId}/caisse/open`, { openingBalanceFcfa: 0 }).expect(201);
    const res = await post(`/farms/${farmId}/sales`, {
      pointOfSaleId: boutiqueId,
      items: [
        {
          productType: 'ABATTU_PIECE',
          unit: 'PIECE',
          quantity: 5,
          unitPriceFcfa: 3000,
          batchId,
          sourceSlaughterOrderId: slaughterOrderId,
          carcassTransferId: transferId,
        },
      ],
      payments: [{ method: 'CASH', amountFcfa: 15000 }],
    }).expect(201);
    saleId = res.body.sale.id;

    const transfers = await get(`/farms/${farmId}/carcass-transfers?pointOfSaleId=${boutiqueId}`).expect(200);
    expect((transfers.body as any[])[0].quantitySold).toBe(5);

    const order = await get(`/farms/${farmId}/slaughter-orders/${slaughterOrderId}`).expect(200);
    expect(order.body.carcassesAvailable).toBe(8);
  });

  it('vente en boutique sans carcassTransferId : 400', async () => {
    const res = await post(`/farms/${farmId}/sales`, {
      pointOfSaleId: boutiqueId,
      items: [
        {
          productType: 'ABATTU_PIECE',
          unit: 'PIECE',
          quantity: 1,
          unitPriceFcfa: 3000,
          batchId,
          sourceSlaughterOrderId: slaughterOrderId,
        },
      ],
      payments: [{ method: 'CASH', amountFcfa: 3000 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('carcassTransferId');
  });

  it('vente en boutique au-delà du reste du transfert : 400', async () => {
    const res = await post(`/farms/${farmId}/sales`, {
      pointOfSaleId: boutiqueId,
      items: [
        {
          productType: 'ABATTU_PIECE',
          unit: 'PIECE',
          quantity: 8,
          unitPriceFcfa: 3000,
          batchId,
          sourceSlaughterOrderId: slaughterOrderId,
          carcassTransferId: transferId,
        },
      ],
      payments: [{ method: 'CASH', amountFcfa: 24000 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Carcasses insuffisantes en boutique');
  });

  it('annulation de la vente boutique : réintègre au transfert', async () => {
    await del(`/farms/${farmId}/sales/${saleId}`).send({ reason: 'Test' }).expect(200);
    const transfers = await get(`/farms/${farmId}/carcass-transfers?pointOfSaleId=${boutiqueId}`).expect(200);
    expect((transfers.body as any[])[0].quantitySold).toBe(0);
    const order = await get(`/farms/${farmId}/slaughter-orders/${slaughterOrderId}`).expect(200);
    expect(order.body.carcassesAvailable).toBe(8);
  });

  it('annulation du transfert : les restes reviennent au pool ferme', async () => {
    await post(`/farms/${farmId}/carcass-transfers/${transferId}/cancel`, {}).expect(201);
    const transfers = await get(`/farms/${farmId}/carcass-transfers`).expect(200);
    expect((transfers.body as any[])[0].status).toBe('CANCELLED');

    const order = await get(`/farms/${farmId}/slaughter-orders/${slaughterOrderId}`).expect(200);
    expect(order.body.carcassesAvailable).toBe(20);
  });

  it('double annulation du transfert : 400', async () => {
    const res = await post(`/farms/${farmId}/carcass-transfers/${transferId}/cancel`, {});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('déjà annulé');
  });
});