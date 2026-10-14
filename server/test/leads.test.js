import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, connect, disconnect, reset, signedInAgent } from './helpers.js';

beforeAll(connect);
beforeEach(reset);
afterAll(disconnect);

const base = { name: 'Olivia Carter', company: 'Northwind Coffee', email: 'olivia@northwind.example', source: 'referral', value: 12000 };

describe('leads', () => {
  it('creates, reads, updates and lists leads with search and filters', async () => {
    const { agent, user } = await signedInAgent();
    const created = await agent.post('/api/leads').send(base);
    expect(created.status).toBe(201);
    expect(created.body.lead).toMatchObject({ name: 'Olivia Carter', stage: 'new', owner: { id: user.id } });
    await agent.post('/api/leads').send({ name: 'Liam Nguyen', company: 'Kestrel Logistics', source: 'ads', value: 900 });

    const id = created.body.lead.id;
    const detail = await agent.get(`/api/leads/${id}`);
    expect(detail.body.activities.map((a) => a.type)).toEqual(['created']);
    expect(detail.body.canEdit).toBe(true);

    const patched = await agent.patch(`/api/leads/${id}`).send({ stage: 'qualified', tags: ['seo'] });
    expect(patched.body.lead).toMatchObject({ stage: 'qualified', tags: ['seo'] });

    expect((await agent.get('/api/leads?q=northwind')).body.items.map((l) => l.name)).toEqual(['Olivia Carter']);
    expect((await agent.get('/api/leads?stage=qualified')).body.total).toBe(1);
    expect((await agent.get('/api/leads?sort=value')).body.items.map((l) => l.value)).toEqual([900, 12000]);
    expect((await agent.get('/api/leads?status=open')).body.total).toBe(2);
    expect((await agent.get('/api/leads?status=closed')).body.total).toBe(0);
    expect((await agent.get('/api/leads?source=bogus')).status).toBe(400);
  });

  it('validates input', async () => {
    const { agent } = await signedInAgent();
    const res = await agent.post('/api/leads').send({ name: '', email: 'not-an-email', value: -5 });
    expect(res.status).toBe(400);
    expect(res.body.fields.map((f) => f.path).sort()).toEqual(['email', 'name', 'value']);
    expect((await agent.get('/api/leads/123')).status).toBe(400);
    expect((await agent.get('/api/leads/64b7f8c2a1b2c3d4e5f60718')).status).toBe(404);
  });

  it('moves cards on the pipeline, reorders the column and logs stage changes', async () => {
    const { agent } = await signedInAgent();
    const a = (await agent.post('/api/leads').send({ name: 'A', stage: 'qualified' })).body.lead;
    const b = (await agent.post('/api/leads').send({ name: 'B', stage: 'qualified' })).body.lead;
    const c = (await agent.post('/api/leads').send({ name: 'C' })).body.lead;

    await agent.patch(`/api/leads/${c.id}/move`).send({ stage: 'qualified', position: 1 });
    const board = (await agent.get('/api/leads/pipeline')).body.stages;
    expect(board.find((s) => s.stage === 'qualified').leads.map((l) => l.name)).toEqual(['B', 'C', 'A']);
    expect(board.find((s) => s.stage === 'new').leads).toEqual([]);

    const won = await agent.patch(`/api/leads/${a.id}/move`).send({ stage: 'won', position: 0 });
    expect(won.body.lead.closedAt).toBeTruthy();
    const acts = (await agent.get(`/api/leads/${c.id}`)).body.activities;
    expect(acts[0]).toMatchObject({ type: 'stage_change', body: 'new → qualified' });
    expect(b.id).toBeTruthy();
  });

  it('logging the first call moves a new lead to contacted', async () => {
    const { agent } = await signedInAgent();
    const lead = (await agent.post('/api/leads').send(base)).body.lead;
    const res = await agent.post(`/api/leads/${lead.id}/activities`).send({ type: 'call', body: 'Intro call, wants a quote.' });
    expect(res.status).toBe(201);
    expect(res.body.lead.stage).toBe('contacted');
    expect(res.body.lead.lastContactedAt).toBeTruthy();
  });

  it('reps cannot edit or delete leads owned by someone else', async () => {
    const { agent: admin } = await signedInAgent();
    const lead = (await admin.post('/api/leads').send(base)).body.lead;
    const rep = request.agent(app);
    await rep.post('/api/auth/register').send({ name: 'Dan Reyes', email: 'dan@example.com', password: 'secret123' });
    expect((await rep.patch(`/api/leads/${lead.id}`).send({ value: 1 })).status).toBe(403);
    expect((await rep.delete(`/api/leads/${lead.id}`)).status).toBe(403);
    expect((await rep.get(`/api/leads/${lead.id}`)).body.canEdit).toBe(false);
    expect((await admin.delete(`/api/leads/${lead.id}`)).status).toBe(204);
  });

  it('scores a lead and drafts an email (rule-based without an API key)', async () => {
    const { agent } = await signedInAgent();
    const lead = (await agent.post('/api/leads').send({ ...base, phone: '+1 555 0100', stage: 'proposal' })).body.lead;
    const { score } = (await agent.post(`/api/leads/${lead.id}/score`)).body;
    expect(score.by).toBe('rules');
    expect(score.value).toBeGreaterThanOrEqual(70);
    expect(score.reasons.join(' ')).toMatch(/referral/);
    const { email } = (await agent.post(`/api/leads/${lead.id}/draft-email`).send({})).body;
    expect(email).toMatchObject({ by: 'template', subject: 'Following up on the proposal' });
    expect(email.body).toMatch(/^Hi Olivia,/);
  });

  it('imports CSV with header aliases, validation and de-duplication', async () => {
    const { agent } = await signedInAgent();
    await agent.post('/api/leads').send(base);
    const csv = 'Full Name,Company,Email,Deal Value,Lead Source,Tags\n' +
      'Emma Patel,Summit Physio,emma@summit.example,"$4,500",LinkedIn,seo;website\n' +
      'Dup Person,Northwind,olivia@northwind.example,100,website,\n' +
      ',No Name Inc,x@y.example,100,website,\n' +
      'Noah Rossi,Atlas Fitness,noah@atlas.example,2000,Cold Outreach,\n';
    const res = await agent.post('/api/leads/import').attach('file', Buffer.from(csv), 'leads.csv');
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2);
    expect(res.body.skipped.map((s) => s.row)).toEqual([3, 4]);
    const emma = (await agent.get('/api/leads?q=emma')).body.items[0];
    expect(emma).toMatchObject({ value: 4500, source: 'linkedin', tags: ['seo', 'website'] });
    expect((await agent.get('/api/leads?q=noah')).body.items[0].source).toBe('cold_outreach');
  });

  it('exports CSV', async () => {
    const { agent } = await signedInAgent();
    await agent.post('/api/leads').send(base);
    const res = await agent.get('/api/leads/export.csv');
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text.split('\n')[1]).toMatch(/^Olivia Carter,Northwind Coffee,olivia@northwind.example/);
  });
});
