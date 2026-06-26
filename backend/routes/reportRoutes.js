const express = require('express');
const router = express.Router();

const {
  createReport,
  getAllReports,
  getStats,
  completeReport,
  acceptReport,
  deleteReport
} = require('../controllers/reportController');

const { uploadSingle, uploadCompletion } = require('../middleware/upload');
const { protect, workerOnly } = require('../middleware/auth');

// POST /api/reports - Create a new report
router.post('/', uploadSingle, createReport);

// GET /api/reports - Get all reports
router.get('/', getAllReports);

// GET /api/reports/stats - Get stats
router.get('/stats', getStats);

// PATCH /api/reports/:id/accept - Accept report task
router.patch('/:id/accept', protect, workerOnly, acceptReport);

// PATCH /api/reports/:id/complete - Complete report task
router.patch('/:id/complete', protect, workerOnly, uploadCompletion, completeReport);

// DELETE /api/reports/:id - Delete a report
router.delete('/:id', protect, deleteReport);

module.exports = router;
