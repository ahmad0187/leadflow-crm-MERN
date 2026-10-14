import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, connect, disconnect, reset, signedInAgent } from './helpers.js';

beforeAll(connect);
beforeEach(reset);
afterAll(disconnect);

describe('auth', () => {
  it('first user becomes admin, later users are reps', async () => {
    const { user } = await signedInAgent();
    expect(user.role).toBe('admin');
    const second = await request(app).post('/api/auth/register').send({ name: 'Dan Reyes', email: 'dan@example.com', password: 'secret123' });
    expect(second.body.user.role).toBe('rep');
  });

  it('never returns the password hash', async () => {
    const { agent } = await signedInAgent();
    const me = await agent.get('/api/auth/me');
    expect(me.body.user).toEqual({ id: expect.any(String), name: 'Sara Khan', email: 'sara@example.com', role: 'admin' });
  });

  it('validates registration and rejects duplicates', async () => {
    const bad = await request(app).post('/api/auth/register').send({ name: 'x', email: 'nope', password: '123' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields.map((f) => f.path).sort()).toEqual(['email', 'name', 'password']);
    await signedInAgent();
    const dup = await request(app).post('/api/auth/register').send({ name: 'Sara Again', email: 'SARA@example.com', password: 'secret123' });
    expect(dup.status).toBe(409);
  });

  it('logs in with cookie or bearer token, and rejects bad passwords', async () => {
    await signedInAgent();
    expect((await request(app).post('/api/auth/login').send({ email: 'sara@example.com', password: 'wrong-pass' })).status).toBe(401);
    const ok = await request(app).post('/api/auth/login').send({ email: 'sara@example.com', password: 'secret123' });
    expect(ok.headers['set-cookie'][0]).toMatch(/leadflow_token=.*HttpOnly/);
    const viaBearer = await request(app).get('/api/auth/me').set('authorization', `Bearer ${ok.body.token}`);
    expect(viaBearer.status).toBe(200);
  });

  it('protects the API', async () => {
    expect((await request(app).get('/api/leads')).status).toBe(401);
    expect((await request(app).get('/api/stats')).status).toBe(401);
  });

  it('logout clears the session cookie', async () => {
    const { agent } = await signedInAgent();
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
