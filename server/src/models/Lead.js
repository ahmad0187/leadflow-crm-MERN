import mongoose from 'mongoose';

export const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
export const SOURCES = ['website', 'referral', 'linkedin', 'cold_outreach', 'ads', 'event', 'other'];

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    company: { type: String, trim: true, maxlength: 120, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    website: { type: String, trim: true, maxlength: 200, default: '' },
    source: { type: String, enum: SOURCES, default: 'other' },
    stage: { type: String, enum: STAGES, default: 'new', index: true },
    /** Order of the card inside its pipeline column. */
    position: { type: Number, default: 0 },
    value: { type: Number, min: 0, default: 0 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    tags: { type: [String], default: [] },
    notes: { type: String, maxlength: 5000, default: '' },
    score: {
      value: { type: Number, min: 0, max: 100, default: null },
      reasons: { type: [String], default: [] },
      nextAction: { type: String, default: '' },
      by: { type: String, enum: ['claude', 'rules', null], default: null },
      updatedAt: { type: Date, default: null },
    },
    lastContactedAt: { type: Date, default: null },
    nextFollowUp: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

leadSchema.index({ stage: 1, position: 1 });
leadSchema.index({ email: 1 });

leadSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

export const Lead = mongoose.model('Lead', leadSchema);
