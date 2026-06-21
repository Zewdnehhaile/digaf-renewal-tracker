// test-mongo.js
import { MongoClient } from 'mongodb';

const uri = "mongodb://admin:MfVVqpAMqZjnf5z0@cluster0.yiz1p7x.mongodb.net:27017/renewal_tracker?ssl=true&authSource=admin&retryWrites=true&w=majority";

async function test() {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });
  
  try {
    console.log("🔌 Connecting...");
    await client.connect();
    console.log("✅ Connected to MongoDB!");
    const db = client.db("renewal_tracker");
    const collection = db.collection("employees_split");
    const count = await collection.countDocuments();
    console.log(`📊 Found ${count} documents`);
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
  } finally {
    await client.close();
  }
}

test();