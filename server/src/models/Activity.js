import mongoose from 'mongoose';

export const ACTIVITY_TYPES = ['created', 'note', 'call', 'email', 'meeting', 'stage_change', 'ai'];

const activitySchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    body: { type: String, maxlength: 5000, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

export const Activity = mongoose.model('Activity', activitySchema);
