const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');

// Prioritize IPv4 resolver order on Windows and use Google DNS
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Load environment variables
dotenv.config();

const Worker = require('./models/Worker');

const workersData = [
  { name: 'Ramesh Verma', phone: '9111111111', ward: 'Vijay Nagar', status: 'available' },
  { name: 'Suresh Patel', phone: '9222222222', ward: 'Palasia', status: 'available' },
  { name: 'Dinesh Sharma', phone: '9333333333', ward: 'Rajwada', status: 'available' },
  { name: 'Mahesh Yadav', phone: '9444444444', ward: 'Scheme 54', status: 'available' }
];

async function seed() {
  try {
    const mongoUri = process.env.MONGO_URI;
    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // Delete all existing workers
    console.log('Deleting existing workers...');
    await Worker.deleteMany({});
    console.log('Deleted existing workers.');

    // Insert new workers
    console.log('Inserting workers...');
    for (const worker of workersData) {
      const createdWorker = await Worker.create(worker);
      console.log(`Inserted worker: ${createdWorker.name}`);
    }

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

seed();
