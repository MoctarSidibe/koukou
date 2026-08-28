import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

function today(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

describe('Tâches & équipe — module Tâches (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let token: string;
  let eleveurToken: string;
  let otherToken: string;
  let farmId: string;
  let eleveurId: string;
  let assignedTaskId: string;
  let unassignedTaskId: string;

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

    const email = `owner.tk.${Date.now()}@e2e.ga`;
    await request(server)
      .post('/auth/register')
      .send({
        phone: `+24172${Date.now()}`,
        email,
        password: 'secret123',
        fullName: 'Proprio Tâches',
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
        name: `Ferme Tâches ${Date.now()}`,
        administrativeCity: 'Libreville',
        capacityPerBuilding: 1000,
      })
      .expect(201);
    farmId = farm.body.id;

    const eleveurEmail = `eleveur.tk.${Date.now()}@e2e.ga`;
    const eleveur = await request(server)
      .post(`/farms/${farmId}/eleveurs`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        phone: `+24173${Date.now()}`,
        email: eleveurEmail,
        fullName: 'Éleveur Tâches',
        password: 'secret456',
      })
      .expect(201);
    eleveurId = eleveur.body.user.id;

    const eleveurLogin = await request(server)
      .post('/auth/login')
      .send({ identifier: eleveurEmail, password: 'secret456' })
      .expect(201);
    eleveurToken = eleveurLogin.body.accessToken;

    const otherEmail = `other.tk.${Date.now()}@e2e.ga`;
    await request(server)
      .post('/auth/register')
      .send({
        phone: `+24174${Date.now()}`,
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
  });

  it('création : tâche assignée à un Éleveur, statut A_FAIRE', async () => {
    const res = await request(server)
      .post(`/farms/${farmId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Relever la ponte',
        notes: 'Après le premier service',
        dueDate: today(2),
        assigneeId: eleveurId,
      })
      .expect(201);
    expect(res.body.status).toBe('A_FAIRE');
    expect(res.body.assigneeId).toBe(eleveurId);
    expect(res.body.dueDate).toBe(today(2));
    assignedTaskId = res.body.id;

    const unassigned = await request(server)
      .post(`/farms/${farmId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Nettoyer le bâtiment 2',
        dueDate: today(5),
      })
      .expect(201);
    unassignedTaskId = unassigned.body.id;
  });

  it('validations : assigné non rattaché → 400, lot inconnu → 400', async () => {
    await request(server)
      .post(`/farms/${farmId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Tâche invalide',
        dueDate: today(1),
        assigneeId: '00000000-0000-4000-8000-000000000000',
      })
      .expect(400);
    await request(server)
      .post(`/farms/${farmId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Tâche lot inconnu',
        dueDate: today(1),
        batchId: '00000000-0000-4000-8000-000000000000',
      })
      .expect(400);
  });

  it('liste scopée : Propriétaire voit tout, Éleveur seulement les siennes', async () => {
    const ownerList = await request(server)
      .get(`/farms/${farmId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((ownerList.body as any[]).length).toBe(2);

    const eleveurList = await request(server)
      .get(`/farms/${farmId}/tasks`)
      .set('Authorization', `Bearer ${eleveurToken}`)
      .expect(200);
    const ids = (eleveurList.body as any[]).map((t) => t.id);
    expect(ids).toContain(assignedTaskId);
    expect(ids).not.toContain(unassignedTaskId);
  });

  it('Éleveur : statut modifiable, titre interdit, tâche non assignée interdite', async () => {
    const advanced = await request(server)
      .patch(`/farms/${farmId}/tasks/${assignedTaskId}`)
      .set('Authorization', `Bearer ${eleveurToken}`)
      .send({ status: 'EN_COURS' })
      .expect(200);
    expect(advanced.body.status).toBe('EN_COURS');

    await request(server)
      .patch(`/farms/${farmId}/tasks/${assignedTaskId}`)
      .set('Authorization', `Bearer ${eleveurToken}`)
      .send({ title: 'Renommée' })
      .expect(403);

    await request(server)
      .patch(`/farms/${farmId}/tasks/${unassignedTaskId}`)
      .set('Authorization', `Bearer ${eleveurToken}`)
      .send({ status: 'FAIT' })
      .expect(403);
  });

  it('tâche en retard → alerte TACHE ROUGE, résolue une fois FAIT', async () => {
    const overdue = await request(server)
      .post(`/farms/${farmId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Tâche en retard',
        dueDate: today(-2),
        assigneeId: eleveurId,
      })
      .expect(201);

    const alerts = await request(server)
      .get(`/farms/${farmId}/alerts`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const tache = (alerts.body as any[]).find((a) => a.kind === 'TACHE');
    expect(tache).toBeTruthy();
    expect(tache.level).toBe('ROUGE');
    expect(tache.status).toBe('ACTIVE');

    await request(server)
      .patch(`/farms/${farmId}/tasks/${overdue.body.id}`)
      .set('Authorization', `Bearer ${eleveurToken}`)
      .send({ status: 'FAIT' })
      .expect(200);

    const after = await request(server)
      .get(`/farms/${farmId}/alerts`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const tacheActive = (after.body as any[]).find(
      (a) => a.kind === 'TACHE' && a.status === 'ACTIVE',
    );
    expect(tacheActive).toBeUndefined();
  });

  it('suppression : Propriétaire OK, Éleveur 403', async () => {
    await request(server)
      .delete(`/farms/${farmId}/tasks/${assignedTaskId}`)
      .set('Authorization', `Bearer ${eleveurToken}`)
      .expect(403);
    await request(server)
      .delete(`/farms/${farmId}/tasks/${assignedTaskId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('autre ferme → 403', async () => {
    await request(server)
      .post(`/farms/${farmId}/tasks`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Intrusion', dueDate: today(1) })
      .expect(403);
    await request(server)
      .get(`/farms/${farmId}/tasks`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });
});
