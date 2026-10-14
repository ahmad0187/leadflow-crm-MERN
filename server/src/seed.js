// Fills the database with realistic demo data (fictional people and companies).
// Run: npm run seed   (WARNING: wipes existing leads, users and activities)
import mongoose from 'mongoose';
import { config } from './config.js';
import { Activity } from './models/Activity.js';
import { Lead } from './models/Lead.js';
import { User } from './models/User.js';
import { ruleScore } from './services/ai.js';

export const DEMO_PASSWORD = 'demo1234';

// Small deterministic PRNG so every seed produces the same demo.
function rng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

const FIRST = ['Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Lucas', 'Isabella', 'Mason', 'Amelia', 'Logan', 'Harper', 'Elijah', 'Zara', 'Omar', 'Hana', 'Diego', 'Priya', 'Felix'];
const LAST = ['Carter', 'Nguyen', 'Patel', 'Rossi', 'Kim', 'Okafor', 'Silva', 'Becker', 'Haddad', 'Lindqvist', 'Moreno', 'Tanaka', 'Walsh', 'Ibrahim', 'Novak'];
const COMPANIES = ['Northwind Coffee', 'Kestrel Logistics', 'Bright Smile Dental', 'Harbor Yoga Studio', 'Oakridge Plumbing', 'Bluepeak Realty', 'Maple & Co Accounting',
  'Summit Physio', 'Cedar Lane Bakery', 'Atlas Fitness', 'Riverstone Law', 'Pixel Forge Studio', 'GreenLeaf Landscaping', 'Nova Solar', 'Juniper Vet Clinic',
  'Copper Kettle Café', 'Ironclad Roofing', 'Lumen Opticians', 'Silverline Dental', 'Willow Spa', 'Quantum Tutors', 'Redwood Builders', 'Seaside Hotel', 'Urban Paws Grooming'];
const TAGS = ['website', 'ai-receptionist', 'chatbot', 'seo', 'automation', 'urgent', 'budget-approved', 'referral'];
const SOURCE_WEIGHTS = [['website', 26], ['referral', 18], ['linkedin', 16], ['cold_outreach', 14], ['ads', 12], ['event', 8], ['other', 6]];
const NOTES = ['Wants online booking added to their site.', 'Missed calls after hours are the main pain point.', 'Asked for a quote for a website redesign.',
  'Interested in an AI chatbot for FAQs.', 'Needs automation between their forms and Google Sheets.', 'Comparing us with two other agencies.'];

export async function seed({ leadsCount = 64, now = new Date() } = {}) {
  const rand = rng(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const weighted = (pairs) => { let r = rand() * pairs.reduce((s, [, w]) => s + w, 0); for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; } return pairs[0][0]; };
  const daysAgo = (d) => new Date(now.getTime() - d * 86400000);

  await Promise.all([Lead.deleteMany({}), Activity.deleteMany({}), User.deleteMany({})]);
  const hash = await User.hashPassword(DEMO_PASSWORD);
  const users = await User.insertMany([
    { name: 'Sara Khan', email: 'admin@leadflow.dev', passwordHash: hash, role: 'admin' },
    { name: 'Daniel Reyes', email: 'daniel@leadflow.dev', passwordHash: hash, role: 'rep' },
    { name: 'Mia Chen', email: 'mia@leadflow.dev', passwordHash: hash, role: 'rep' },
  ]);

  const leads = [];
  for (let i = 0; i < leadsCount; i++) {
    const createdDaysAgo = Math.floor(rand() * 175);
    const age = createdDaysAgo;
    // Older leads are more likely to have progressed or closed.
    const stage = age > 60 ? weighted([['won', 30], ['lost', 25], ['proposal', 15], ['qualified', 12], ['contacted', 10], ['new', 8]])
      : age > 20 ? weighted([['contacted', 26], ['qualified', 24], ['proposal', 18], ['won', 12], ['lost', 8], ['new', 12]])
        : weighted([['new', 45], ['contacted', 30], ['qualified', 15], ['proposal', 10]]);
    const first = pick(FIRST);
    const last = pick(LAST);
    const company = COMPANIES[i % COMPANIES.length];
    const createdAt = daysAgo(createdDaysAgo);
    const contacted = stage !== 'new' ? daysAgo(Math.max(0, createdDaysAgo - Math.floor(rand() * Math.min(createdDaysAgo, 30)))) : null;
    leads.push({
      name: `${first} ${last}`,
      company,
      email: `${first}.${last}${i}@${company.toLowerCase().replace(/[^a-z]/g, '')}.example`.toLowerCase(),
      phone: `+1 555 ${String(100 + Math.floor(rand() * 900))} ${String(1000 + Math.floor(rand() * 9000))}`,
      source: weighted(SOURCE_WEIGHTS),
      stage,
      value: Math.round((800 + rand() * rand() * 18000) / 50) * 50,
      owner: users[i % 3]._id,
      tags: [pick(TAGS), ...(rand() > 0.6 ? [pick(TAGS)] : [])].filter((t, j, a) => a.indexOf(t) === j),
      notes: pick(NOTES),
      position: i,
      createdAt,
      updatedAt: createdAt,
      lastContactedAt: contacted,
      closedAt: ['won', 'lost'].includes(stage) ? daysAgo(Math.floor(rand() * Math.min(createdDaysAgo, 75))) : null,
      nextFollowUp: ['new', 'contacted', 'qualified', 'proposal'].includes(stage) ? daysAgo(Math.floor(rand() * 10) - 5) : null,
    });
  }
  // Mongoose would overwrite createdAt; insert through the driver to keep historic dates.
  const { insertedIds } = await Lead.collection.insertMany(leads.map((l) => ({ ...l, score: { value: null, reasons: [], nextAction: '', by: null, updatedAt: null } })));
  const ids = Object.values(insertedIds);

  const activities = [];
  ids.forEach((id, i) => {
    const l = leads[i];
    activities.push({ lead: id, user: l.owner, type: 'created', body: 'Lead created', meta: {}, createdAt: l.createdAt });
    if (l.lastContactedAt) {
      activities.push({ lead: id, user: l.owner, type: pick(['call', 'email', 'meeting']), body: pick(['Intro call, discussed goals and budget.', 'Sent overview and case studies.', 'Demo of the AI receptionist went well.']), meta: {}, createdAt: l.lastContactedAt });
    }
    if (l.stage !== 'new') activities.push({ lead: id, user: l.owner, type: 'stage_change', body: `new → ${l.stage}`, meta: { from: 'new', to: l.stage }, createdAt: l.closedAt || l.lastContactedAt || l.createdAt });
  });
  await Activity.collection.insertMany(activities);

  // Score every lead with the rule engine so the board shows scores immediately.
  const docs = await Lead.find();
  await Lead.bulkWrite(docs.map((d) => {
    const acts = activities.filter((a) => a.lead.equals(d._id));
    return { updateOne: { filter: { _id: d._id }, update: { $set: { score: { ...ruleScore(d.toObject(), acts, now), updatedAt: now } } } } };
  }));

  return { users: users.length, leads: ids.length, activities: activities.length };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  await mongoose.connect(config.mongoUrl);
  const result = await seed();
  console.log(`Seeded ${result.users} users, ${result.leads} leads, ${result.activities} activities.`);
  console.log(`Sign in with admin@leadflow.dev / ${DEMO_PASSWORD}`);
  await mongoose.disconnect();
}
