const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Worker = require('../models/Worker');

router.get('/', async (req, res) => {
  try {
    const users = await User.find({ role: 'worker' }).select('name phone ward');
    const workersWithStatus = await Promise.all(users.map(async (u) => {
      const workerDoc = await Worker.findById(u._id);
      return {
        _id: u._id,
        name: u.name,
        phone: u.phone,
        ward: u.ward,
        status: workerDoc ? workerDoc.status : 'available'
      };
    }));
    return res.json({ success: true, workers: workersWithStatus });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
