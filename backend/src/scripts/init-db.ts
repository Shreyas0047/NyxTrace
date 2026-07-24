import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function initDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nyxtrace';
  console.log(`Connecting to ${uri}...`);
  await mongoose.connect(uri);
  console.log('Connected. Creating indexes...');

  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection');

  const collections = await db.listCollections().toArray();
  console.log(`Found ${collections.length} existing collections`);

  await mongoose.disconnect();
  console.log('Database initialization complete.');
}

initDatabase().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
