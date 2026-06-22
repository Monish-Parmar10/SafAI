const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Worker = require('../models/Worker');


const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// REGISTER
const register = async (req, res) => {
  try {
    const { name, password, phone, role, ward } = req.body;

    // Validation
    if (!name || !password || !phone) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Phone must be 10 digits' });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Phone number already registered' });
    }

    const user = await User.create({ name, password, phone, role: role || 'user', ward: ward || '' });

    if (user.role === 'worker') {
      await Worker.create({
        _id: user._id,
        name: user.name,
        phone: user.phone,
        ward: user.ward || 'General',
        status: 'available'
      });
    }

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, role: user.role, phone: user.phone, ward: user.ward }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone number and password required' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid phone number or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid phone number or password' });
    }

    const token = generateToken(user._id);

    if (user.role === 'worker') {
      const workerExists = await Worker.findById(user._id);
      if (!workerExists) {
        await Worker.create({
          _id: user._id,
          name: user.name,
          phone: user.phone,
          ward: user.ward || 'General',
          status: 'available'
        });
      }
    }

    return res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, role: user.role, phone: user.phone, ward: user.ward }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET ME
const getMe = async (req, res) => {
  return res.status(200).json({ success: true, user: req.user });
};

// DELETE ACCOUNT
const deleteMe = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If they are a worker, delete Worker record too
    if (user.role === 'worker') {
      await Worker.findByIdAndDelete(userId);
    }

    await User.findByIdAndDelete(userId);

    return res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, login, getMe, deleteMe };
