const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
const fs = require('fs');
const path = require('path');

// Prioritize IPv4 resolver order on Windows and use Google DNS
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Load environment variables
dotenv.config();

const Report = require('./models/Report');
const Worker = require('./models/Worker');

const reportsData = [
  {
    imageUrl: '/uploads/demo1.jpg',
    location: { lat: 22.7196, lng: 75.8577, address: 'Rajwada Chowk, Near Clock Tower' },
    aiDetected: true, aiConfidence: 95, severity: 'high',
    status: 'done', completionImageUrl: '/uploads/demo1.jpg',
    completedAt: new Date(Date.now() - 1000 * 60 * 30)
  },
  {
    imageUrl: '/uploads/demo1.jpg',
    location: { lat: 22.7244, lng: 75.8839, address: 'Vijay Nagar Square, Near D-Mart' },
    aiDetected: true, aiConfidence: 88, severity: 'high',
    status: 'done', completionImageUrl: '/uploads/demo1.jpg',
    completedAt: new Date(Date.now() - 1000 * 60 * 60)
  },
  {
    imageUrl: '/uploads/demo1.jpg',
    location: { lat: 22.7089, lng: 75.8672, address: 'Palasia Square, Near Curewell Hospital' },
    aiDetected: true, aiConfidence: 76, severity: 'medium',
    status: 'done', completionImageUrl: '/uploads/demo1.jpg',
    completedAt: new Date(Date.now() - 1000 * 60 * 90)
  },
  {
    imageUrl: '/uploads/demo1.jpg',
    location: { lat: 22.7341, lng: 75.8673, address: 'Scheme 54, AB Road Near Big Bazaar' },
    aiDetected: true, aiConfidence: 91, severity: 'high',
    status: 'done', completionImageUrl: '/uploads/demo1.jpg',
    completedAt: new Date(Date.now() - 1000 * 60 * 45)
  },
  {
    imageUrl: '/uploads/demo1.jpg',
    location: { lat: 22.7532, lng: 75.9012, address: 'Bhawarkuan Square, Ring Road' },
    aiDetected: true, aiConfidence: 82, severity: 'medium',
    status: 'done', completionImageUrl: '/uploads/demo1.jpg',
    completedAt: new Date(Date.now() - 1000 * 60 * 20)
  },
  {
    imageUrl: '/uploads/demo1.jpg',
    location: { lat: 22.6918, lng: 75.8371, address: 'Manglia Chowk, Near Toll Naka' },
    aiDetected: true, aiConfidence: 79, severity: 'medium',
    status: 'assigned'
  },
  {
    imageUrl: '/uploads/demo1.jpg',
    location: { lat: 22.7421, lng: 75.8234, address: 'Bicholi Hapsi, Near Railway Crossing' },
    aiDetected: true, aiConfidence: 94, severity: 'high',
    status: 'assigned'
  },
  {
    imageUrl: '/uploads/demo1.jpg',
    location: { lat: 22.7634, lng: 75.8821, address: 'Rau Pithampur Road, Near Bus Stand' },
    aiDetected: true, aiConfidence: 67, severity: 'medium',
    status: 'open'
  }
];

async function seedReports() {
  try {
    const mongoUri = process.env.MONGO_URI;
    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Delete all existing reports
    console.log('Deleting existing reports...');
    await Report.deleteMany({});
    console.log('Deleted existing reports.');

    // 2. Reset all workers to status='available', currentTask=null
    console.log('Resetting workers to available...');
    await Worker.updateMany({}, { status: 'available', currentTask: null });
    console.log('Reset workers.');

    // 3. Create demo1.jpg placeholder image in uploads folder
    const uploadsDir = path.join(__dirname, 'uploads');
    const demoImgPath = path.join(uploadsDir, 'demo1.jpg');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const files = fs.readdirSync(uploadsDir);
    const existingImg = files.find(f => f !== 'demo1.jpg' && (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')));

    if (existingImg) {
      fs.copyFileSync(path.join(uploadsDir, existingImg), demoImgPath);
      console.log(`Copied existing image ${existingImg} to demo1.jpg`);
    } else {
      fs.writeFileSync(demoImgPath, 'placeholder');
      console.log('Created a placeholder file for demo1.jpg');
    }

    // 4. Insert reports
    console.log('Inserting 8 demo reports...');
    const insertedReports = await Report.insertMany(reportsData);

    // 5. Assign the 2 assigned reports to Ramesh Verma and Suresh Patel
    const ramesh = await Worker.findOne({ name: 'Ramesh Verma' });
    const suresh = await Worker.findOne({ name: 'Suresh Patel' });

    const assignedReports = insertedReports.filter(r => r.status === 'assigned');

    if (assignedReports.length >= 2) {
      if (ramesh) {
        ramesh.status = 'busy';
        ramesh.currentTask = assignedReports[0]._id;
        await ramesh.save();

        assignedReports[0].assignedWorker = ramesh._id;
        await assignedReports[0].save();
      }

      if (suresh) {
        suresh.status = 'busy';
        suresh.currentTask = assignedReports[1]._id;
        await suresh.save();

        assignedReports[1].assignedWorker = suresh._id;
        await assignedReports[1].save();
      }
    }

    console.log('Seeded 8 reports: 5 done, 2 assigned, 1 open');
    console.log('Workers assigned: Ramesh Verma, Suresh Patel');

  } catch (error) {
    console.error('Error seeding reports:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

seedReports();
