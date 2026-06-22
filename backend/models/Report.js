const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String, default: '' }
  },
  aiDetected: { type: Boolean, default: false },
  aiConfidence: { type: Number, default: 0 },
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  status: { type: String, enum: ['open', 'pending', 'assigned', 'accepted', 'done', 'completed'], default: 'open' },
  assignedWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', default: null },
  completionImageUrl: { type: String, default: '' },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Report', ReportSchema);
