import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';

export const app = createApp();

export async function connect() {
  await mongoose.connect(process.env.MONGO_URL);
}

export async function reset() {
  for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
}

export async function disconnect() {
  await mongoose.disconnect();
}

/** Registers a user and returns a supertest agent that keeps the auth cookie. */
export async function signedInAgent(name = 'Sara Khan', email = 'sara@example.com', password = 'secret123') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name, email, password });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user };
}
