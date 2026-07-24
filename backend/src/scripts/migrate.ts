import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS: Array<{ version: number; name: string; run: (db: mongoose.mongo.Db) => Promise<void> }> = [
  {
    version: 1,
    name: 'Initial schema setup',
    run: async () => {
      // Placeholder — migrations are applied on this version.
    },
  },
];

async function runMigrations() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nyxtrace';
  console.log(`Connecting to ${uri}...`);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection');

  const migrationsMeta = db.collection('_migrations');
  const applied = await migrationsMeta.find().sort({ version: 1 }).toArray();
  const appliedVersions = new Set(applied.map((m: any) => m.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) {
      console.log(`Skipping v${migration.version} — already applied`);
      continue;
    }
    console.log(`Running v${migration.version}: ${migration.name}...`);
    await migration.run(db);
    await migrationsMeta.insertOne({ version: migration.version, name: migration.name, appliedAt: new Date() });
    console.log(`v${migration.version} applied`);
  }

  await mongoose.disconnect();
  console.log('Migrations complete.');
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
