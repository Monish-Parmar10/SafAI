const mongoose = require('mongoose');

const WorkerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  ward: { type: String, required: true },
  status: { type: String, enum: ['available', 'busy'], default: 'available' },
  currentTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Worker', WorkerSchema);
