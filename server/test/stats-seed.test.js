import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed } from '../src/seed.js';
import { ruleScore } from '../src/services/ai.js';
import { app, connect, disconnect, reset } from './helpers.js';
import request from 'supertest';

beforeAll(async () => { await connect(); await reset(); });
afterAll(disconnect);

describe('seed + dashboard stats', () => {
  it('seeds demo data and computes pipeline stats', async () => {
    const result = await seed({ leadsCount: 40 });
    expect(result).toMatchObject({ users: 3, leads: 40 });
    const agent = request.agent(app);
    expect((await agent.post('/api/auth/login').send({ email: 'admin@leadflow.dev', password: 'demo1234' })).status).toBe(200);
    const stats = (await agent.get('/api/stats')).body;
    expect(stats.totals.leads).toBe(40);
    expect(stats.byStage.reduce((s, x) => s + x.count, 0)).toBe(40);
    expect(stats.monthly).toHaveLength(6);
    expect(stats.totals.winRate).toBeGreaterThanOrEqual(0);
    expect(stats.leaderboard.length).toBeGreaterThan(0);
    const board = (await agent.get('/api/leads?sort=-score&limit=5')).body.items;
    expect(board[0].score.value).toBeGreaterThanOrEqual(board[4].score.value);
  });
});

describe('ruleScore', () => {
  const now = new Date('2026-10-14');
  const lead = { name: 'A', source: 'referral', stage: 'proposal', value: 15000, email: 'a@b.c', phone: '1', company: 'X', createdAt: new Date('2026-10-01'), lastContactedAt: new Date('2026-10-12') };
  it('rewards strong signals and explains why', () => {
    const r = ruleScore(lead, [{ type: 'call' }, { type: 'email' }], now);
    expect(r.value).toBe(100);
    expect(r.reasons[0]).toMatch(/referral/);
    expect(r.nextAction).toMatch(/proposal/);
  });
  it('penalises neglected leads', () => {
    const cold = ruleScore({ ...lead, source: 'cold_outreach', stage: 'new', value: 300, phone: '', lastContactedAt: null, createdAt: new Date('2026-08-01') }, [], now);
    expect(cold.value).toBeLessThan(35);
    expect(cold.reasons.join()).toMatch(/never contacted/);
  });
  it('pins won and lost deals', () => {
    expect(ruleScore({ ...lead, stage: 'won' }, [], now).value).toBe(100);
    expect(ruleScore({ ...lead, stage: 'lost' }, [], now).value).toBe(0);
  });
});
