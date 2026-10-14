import { Lead, STAGES } from '../models/Lead.js';
import { User } from '../models/User.js';

/**
 * Dashboard numbers. Computed from one projected query so it works on MongoDB and
 * MongoDB-compatible engines alike; for very large datasets move this into an aggregation pipeline.
 */
export async function pipelineStats(now = new Date()) {
  const leads = await Lead.find({}, { stage: 1, value: 1, source: 1, owner: 1, createdAt: 1, closedAt: 1, 'score.value': 1, nextFollowUp: 1 }).lean();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const byStage = Object.fromEntries(STAGES.map((s) => [s, { stage: s, count: 0, value: 0 }]));
  const bySource = {};
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en-US', { month: 'short' }), created: 0, won: 0 });
  }
  const monthIndex = Object.fromEntries(months.map((m, i) => [m.key, i]));
  const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const owners = {};

  let wonThisMonth = 0;
  let followUpsDue = 0;
  for (const l of leads) {
    byStage[l.stage].count++;
    byStage[l.stage].value += l.value || 0;
    bySource[l.source] = (bySource[l.source] || 0) + 1;
    const ci = monthIndex[keyOf(new Date(l.createdAt))];
    if (ci !== undefined) months[ci].created++;
    if (l.stage === 'won' && l.closedAt) {
      const wi = monthIndex[keyOf(new Date(l.closedAt))];
      if (wi !== undefined) months[wi].won++;
      if (new Date(l.closedAt) >= monthStart) wonThisMonth += l.value || 0;
    }
    if (l.nextFollowUp && new Date(l.nextFollowUp) <= now && !['won', 'lost'].includes(l.stage)) followUpsDue++;
    if (l.owner) {
      const k = l.owner.toString();
      owners[k] ??= { won: 0, wonValue: 0, open: 0 };
      if (l.stage === 'won') { owners[k].won++; owners[k].wonValue += l.value || 0; } else if (l.stage !== 'lost') owners[k].open++;
    }
  }

  const closed = byStage.won.count + byStage.lost.count;
  const openStages = ['new', 'contacted', 'qualified', 'proposal'];
  const users = await User.find({ _id: { $in: Object.keys(owners) } }).lean();

  return {
    totals: {
      leads: leads.length,
      openPipelineValue: openStages.reduce((s, k) => s + byStage[k].value, 0),
      openDeals: openStages.reduce((s, k) => s + byStage[k].count, 0),
      wonThisMonth,
      winRate: closed ? Math.round((byStage.won.count / closed) * 100) : 0,
      avgDealSize: byStage.won.count ? Math.round(byStage.won.value / byStage.won.count) : 0,
      followUpsDue,
    },
    byStage: STAGES.map((s) => byStage[s]),
    bySource: Object.entries(bySource).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    monthly: months,
    leaderboard: users
      .map((u) => ({ id: u._id.toString(), name: u.name, ...owners[u._id.toString()] }))
      .sort((a, b) => b.wonValue - a.wonValue),
  };
}
