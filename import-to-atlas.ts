import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

// Your Exact MongoDB Atlas connection string
const MONGODB_URI = "mongodb://Digaf_MFI:erCb6Ucnq5pNBS3K@ac-nkqt4y6-shard-00-00.yiz1p7x.mongodb.net:27017,ac-nkqt4y6-shard-00-01.yiz1p7x.mongodb.net:27017,ac-nkqt4y6-shard-00-02.yiz1p7x.mongodb.net:27017/?ssl=true&replicaSet=atlas-fqjsli-shard-0&authSource=admin&retryWrites=true&w=majority";
const DB_NAME = "renewal_tracker";

const collections = [
  "users", 
  "customers", 
  "attendance_records", 
  "attendance_settings", 
  "officer_permissions", 
  "system_errors", 
  "activity_logs", 
  "ai_config", 
  "chats"
];

async function seedDatabase() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas database: renewal_tracker...");
    const db = client.db(DB_NAME);

    for (const col of collections) {
      const filePath = path.join(process.cwd(), 'firestore-exporter', `${col}.json`);
      if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${col}: JSON file not found at ${filePath}`);
        continue;
      }

      console.log(`Reading ${col}.json...`);
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Keep Firestore Document IDs as the MongoDB standard _id
      const documents = Object.entries(fileData).map(([id, data]) => ({
        _id: id, 
        ...(data as object)
      }));

      if (documents.length === 0) {
        console.log(`Collection ${col} is empty.`);
        continue;
      }

      console.log(`Importing ${documents.length} documents into MongoDB collection: ${col}...`);
      
      // Wipe the target collection first to avoid duplicate key errors on rerun
      await db.collection(col).deleteMany({});
      await db.collection(col).insertMany(documents);
      console.log(`✅ Successfully seeded MongoDB collection: ${col}`);
    }
  } catch (error) {
    console.error("Seeding process failed:", error);
  } finally {
    await client.close();
    console.log("Database client closed.");
  }
}

seedDatabase();
