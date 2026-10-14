import { parse } from 'csv-parse/sync';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler, HttpError, validate } from '../middleware/error.js';
import { Activity, ACTIVITY_TYPES } from '../models/Activity.js';
import { Lead, SOURCES, STAGES } from '../models/Lead.js';
import { draftEmail, scoreLead } from '../services/ai.js';

const router = Router();

// ------------------------------------------------------------------ validation
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const LeadFields = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  company: z.string().trim().max(120).optional(),
  email: z.union([z.string().trim().email('Invalid email').max(160), z.literal('')]).optional(),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().max(200).optional(),
  source: z.enum(SOURCES).optional(),
  stage: z.enum(STAGES).optional(),
  value: z.coerce.number().min(0).max(100_000_000).optional(),
  owner: objectId.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  notes: z.string().max(5000).optional(),
  nextFollowUp: z.coerce.date().nullable().optional(),
});
const ListQuery = z.object({
  stage: z.enum(STAGES).optional(),
  status: z.enum(['open', 'closed']).optional(),
  source: z.enum(SOURCES).optional(),
  owner: z.union([z.literal('me'), z.literal('unassigned'), objectId]).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['createdAt', '-createdAt', 'value', '-value', 'score', '-score', 'name', '-name']).default('-createdAt'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const Move = z.object({ stage: z.enum(STAGES), position: z.number().int().min(0) });
const NewActivity = z.object({ type: z.enum(['note', 'call', 'email', 'meeting']), body: z.string().trim().min(1).max(5000) });

// ------------------------------------------------------------------ helpers
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function canEdit(user, lead) {
  return user.role === 'admin' || !lead.owner || lead.owner.toString() === user._id.toString();
}

async function loadLead(req) {
  const lead = await Lead.findById(objectId.parse(req.params.id)).populate('owner', 'name email role');
  if (!lead) throw new HttpError(404, 'Lead not found');
  return lead;
}

function assertCanEdit(user, lead) {
  const ownerId = lead.owner?._id ?? lead.owner;
  if (!canEdit(user, { owner: ownerId })) throw new HttpError(403, 'Only the lead owner or an admin can change this lead');
}

async function log(lead, user, type, body = '', meta = {}) {
  return Activity.create({ lead: lead._id, user: user?._id ?? null, type, body, meta });
}

function applyStage(lead, stage) {
  if (stage === lead.stage) return false;
  lead.stage = stage;
  lead.closedAt = ['won', 'lost'].includes(stage) ? new Date() : null;
  return true;
}

// ------------------------------------------------------------------ list / pipeline
router.get('/', validate(ListQuery, 'query'), asyncHandler(async (req, res) => {
  const { stage, status, source, owner, q, sort, page, limit } = req.validQuery;
  const filter = {};
  if (stage) filter.stage = stage;
  else if (status) filter.stage = { [status === 'open' ? '$nin' : '$in']: ['won', 'lost'] };
  if (source) filter.source = source;
  if (owner === 'me') filter.owner = req.user._id;
  else if (owner === 'unassigned') filter.owner = null;
  else if (owner) filter.owner = owner;
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: re }, { company: re }, { email: re }];
  }
  const sortField = sort.replace('-', '') === 'score' ? 'score.value' : sort.replace('-', '');
  const [items, total] = await Promise.all([
    Lead.find(filter).sort({ [sortField]: sort.startsWith('-') ? -1 : 1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate('owner', 'name email role'),
    Lead.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));

router.get('/pipeline', asyncHandler(async (req, res) => {
  const filter = req.query.owner === 'me' ? { owner: req.user._id } : {};
  const leads = await Lead.find(filter).sort({ position: 1, createdAt: -1 }).limit(1000).populate('owner', 'name email role');
  res.json({ stages: STAGES.map((stage) => ({ stage, leads: leads.filter((l) => l.stage === stage) })) });
}));

router.get('/export.csv', asyncHandler(async (_req, res) => {
  const leads = await Lead.find().sort({ createdAt: -1 }).populate('owner', 'name').lean();
  const cols = ['name', 'company', 'email', 'phone', 'source', 'stage', 'value', 'owner', 'score', 'tags', 'createdAt'];
  const cell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = leads.map((l) => [l.name, l.company, l.email, l.phone, l.source, l.stage, l.value, l.owner?.name, l.score?.value, (l.tags || []).join('; '), l.createdAt?.toISOString()].map(cell).join(','));
  res.type('text/csv').attachment('leads.csv').send([cols.join(','), ...rows].join('\n') + '\n');
}));

// ------------------------------------------------------------------ CSV import
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
const HEADER_ALIASES = {
  name: ['name', 'full name', 'contact', 'contact name'], company: ['company', 'organization', 'organisation', 'business'],
  email: ['email', 'e-mail', 'email address'], phone: ['phone', 'phone number', 'mobile', 'tel'],
  value: ['value', 'deal value', 'amount', 'budget'], source: ['source', 'lead source'], stage: ['stage', 'status'],
  tags: ['tags', 'labels'], website: ['website', 'url', 'site'], notes: ['notes', 'note', 'comments'],
};

router.post('/import', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose a CSV file');
  let records;
  try {
    records = parse(req.file.buffer.toString('utf8').replace(/^﻿/, ''), { columns: (h) => h.map((x) => x.trim().toLowerCase()), skip_empty_lines: true, trim: true, relax_column_count: true });
  } catch {
    throw new HttpError(400, 'That file is not a valid CSV');
  }
  if (records.length > 2000) throw new HttpError(400, 'Import up to 2,000 rows at a time');

  const pick = (row, field) => HEADER_ALIASES[field].map((h) => row[h]).find((v) => v !== undefined && v !== '');
  const existing = new Set((await Lead.find({ email: { $ne: '' } }, { email: 1 }).lean()).map((l) => l.email));
  const toInsert = [];
  const skipped = [];
  records.forEach((row, i) => {
    const candidate = {
      name: pick(row, 'name'), company: pick(row, 'company') ?? '', email: (pick(row, 'email') ?? '').toLowerCase(),
      phone: pick(row, 'phone') ?? '', website: pick(row, 'website') ?? '', notes: pick(row, 'notes') ?? '',
      value: pick(row, 'value') ? Number(String(pick(row, 'value')).replace(/[^\d.]/g, '')) : 0,
      source: SOURCES.includes(String(pick(row, 'source')).toLowerCase().replace(/\s+/g, '_')) ? String(pick(row, 'source')).toLowerCase().replace(/\s+/g, '_') : 'other',
      stage: STAGES.includes(String(pick(row, 'stage')).toLowerCase()) ? String(pick(row, 'stage')).toLowerCase() : 'new',
      tags: pick(row, 'tags') ? String(pick(row, 'tags')).split(/[;|]/).map((t) => t.trim()).filter(Boolean).slice(0, 20) : [],
    };
    const parsed = LeadFields.safeParse(candidate);
    if (!parsed.success) return skipped.push({ row: i + 2, reason: parsed.error.issues[0].message });
    if (candidate.email && existing.has(candidate.email)) return skipped.push({ row: i + 2, reason: `Duplicate email ${candidate.email}` });
    if (candidate.email) existing.add(candidate.email);
    toInsert.push({ ...parsed.data, owner: req.user._id, position: i });
  });

  const inserted = toInsert.length ? await Lead.insertMany(toInsert) : [];
  if (inserted.length) {
    await Activity.insertMany(inserted.map((l) => ({ lead: l._id, user: req.user._id, type: 'created', body: 'Imported from CSV' })));
  }
  res.status(201).json({ imported: inserted.length, skipped });
}));

// ------------------------------------------------------------------ single lead
router.post('/', validate(LeadFields), asyncHandler(async (req, res) => {
  const stage = req.body.stage ?? 'new';
  const top = await Lead.findOne({ stage }).sort({ position: 1 }).lean();
  const lead = await Lead.create({
    ...req.body,
    owner: req.body.owner === undefined ? req.user._id : req.body.owner,
    position: top ? top.position - 1 : 0,
    closedAt: ['won', 'lost'].includes(stage) ? new Date() : null,
  });
  await log(lead, req.user, 'created', 'Lead created');
  await lead.populate('owner', 'name email role');
  res.status(201).json({ lead });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const lead = await loadLead(req);
  const activities = await Activity.find({ lead: lead._id }).sort({ createdAt: -1 }).limit(100).populate('user', 'name');
  res.json({ lead, activities, canEdit: canEdit(req.user, { owner: lead.owner?._id }) });
}));

router.patch('/:id', validate(LeadFields.partial()), asyncHandler(async (req, res) => {
  const lead = await loadLead(req);
  assertCanEdit(req.user, lead);
  const { stage, ...rest } = req.body;
  const from = lead.stage;
  Object.assign(lead, rest);
  if (stage && applyStage(lead, stage)) await log(lead, req.user, 'stage_change', `${from} → ${stage}`, { from, to: stage });
  await lead.save();
  await lead.populate('owner', 'name email role');
  res.json({ lead });
}));

router.patch('/:id/move', validate(Move), asyncHandler(async (req, res) => {
  const lead = await loadLead(req);
  assertCanEdit(req.user, lead);
  const { stage, position } = req.body;
  const from = lead.stage;
  const column = await Lead.find({ stage, _id: { $ne: lead._id } }).sort({ position: 1, createdAt: -1 }).select('_id').lean();
  column.splice(Math.min(position, column.length), 0, { _id: lead._id });
  await Lead.bulkWrite(column.map((l, i) => ({ updateOne: { filter: { _id: l._id }, update: { $set: { position: i } } } })));
  lead.position = column.findIndex((l) => l._id.equals(lead._id));
  if (applyStage(lead, stage)) await log(lead, req.user, 'stage_change', `${from} → ${stage}`, { from, to: stage });
  await lead.save();
  res.json({ lead });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const lead = await loadLead(req);
  if (req.user.role !== 'admin' && lead.owner?._id?.toString() !== req.user._id.toString()) {
    throw new HttpError(403, 'Only the owner or an admin can delete this lead');
  }
  await Promise.all([Activity.deleteMany({ lead: lead._id }), lead.deleteOne()]);
  res.status(204).end();
}));

// ------------------------------------------------------------------ activity timeline
router.post('/:id/activities', validate(NewActivity), asyncHandler(async (req, res) => {
  const lead = await loadLead(req);
  const activity = await log(lead, req.user, req.body.type, req.body.body);
  if (['call', 'email', 'meeting'].includes(req.body.type)) {
    lead.lastContactedAt = new Date();
    if (lead.stage === 'new' && canEdit(req.user, { owner: lead.owner?._id })) {
      applyStage(lead, 'contacted');
      await log(lead, req.user, 'stage_change', 'new → contacted (first conversation logged)', { from: 'new', to: 'contacted' });
    }
    await lead.save();
  }
  await activity.populate('user', 'name');
  res.status(201).json({ activity, lead });
}));

// ------------------------------------------------------------------ AI
router.post('/:id/score', asyncHandler(async (req, res) => {
  const lead = await loadLead(req);
  const activities = await Activity.find({ lead: lead._id }).sort({ createdAt: -1 }).limit(20).lean();
  const result = await scoreLead(lead.toObject(), activities);
  lead.score = { ...result, updatedAt: new Date() };
  await lead.save();
  await log(lead, req.user, 'ai', `Lead scored ${result.value}/100`, { by: result.by });
  res.json({ score: lead.score });
}));

router.post('/:id/draft-email', validate(z.object({ goal: z.string().trim().max(200).optional() })), asyncHandler(async (req, res) => {
  const lead = await loadLead(req);
  const activities = await Activity.find({ lead: lead._id }).sort({ createdAt: -1 }).limit(10).lean();
  res.json({ email: await draftEmail(lead.toObject(), activities, req.user.name, req.body.goal) });
}));

export { ACTIVITY_TYPES };
export default router;
