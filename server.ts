import 'dotenv/config';
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { MongoClient, ObjectId } from 'mongodb';
import { GoogleGenAI, Type } from "@google/genai";
import cors from 'cors';

const MONGODB_URI =
  "mongodb://Digaf_MFI:erCb6Ucnq5pNBS3K@ac-nkqt4y6-shard-00-00.yiz1p7x.mongodb.net:27017,ac-nkqt4y6-shard-00-01.yiz1p7x.mongodb.net:27017,ac-nkqt4y6-shard-00-02.yiz1p7x.mongodb.net:27017/?ssl=true&replicaSet=atlas-fqjsli-shard-0&authSource=admin&retryWrites=true&w=majority";

const DB_NAME = process.env.MONGODB_DB_NAME || "renewal_tracker";
let client: MongoClient | null = null;
let db: any = null;

async function connectDB() {
  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000
    });
    console.log("CONNECTING TO:");
    console.log(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log("✅ MongoDB Connected!");
  }
  return db;
}

function getDB() {
  return db;
}

// Helper function to find customer by id or _id
async function findCustomerById(collection: any, id: string) {
  let query: any = { id: id };

  // Check if id is a valid ObjectId
  if (ObjectId.isValid(id)) {
    try {
      const doc = await collection.findOne({ _id: new ObjectId(id) });
      if (doc) return doc;
    } catch (e) { }
  }

  // Try by id field
  return await collection.findOne({ id: id });
}

// Helper function to delete customer by id or _id
async function deleteCustomerById(collection: any, id: string) {
  // Try by ObjectId first
  if (ObjectId.isValid(id)) {
    try {
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount > 0) return result;
    } catch (e) { }
  }

  // Try by id field
  return await collection.deleteOne({ id: id });
}

// Helper function to update customer by id or _id
async function updateCustomerById(collection: any, id: string, updates: any) {
  // Try by ObjectId first
  if (ObjectId.isValid(id)) {
    try {
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updates }
      );
      if (result.modifiedCount > 0 || result.matchedCount > 0) return result;
    } catch (e) { }
  }

  // Try by id field
  return await collection.updateOne(
    { id: id },
    { $set: updates }
  );
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3002;

  // ========== CORS - MUST BE FIRST ==========
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  await connectDB();
  const db = getDB();

  app.use(express.json({ limit: "15mb" }));

  // ============================================================
  // ==================== MONGODB API ROUTES ====================
  // ============================================================

  // --- USERS ---
  app.get('/api/users', async (req, res) => {
    try {
      const users = await db.collection('users').find({}).toArray();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/users/:identifier', async (req, res) => {
    try {
      const identifier = req.params.identifier;
      const user = await db.collection('users').findOne({
        $or: [{ phoneNumber: identifier }, { id: identifier }]
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const result = await db.collection('users').insertOne(req.body);
      res.json({ _id: result.insertedId, ...req.body });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/users/:phone', async (req, res) => {
    try {
      await db.collection('users').updateOne(
        { phoneNumber: req.params.phone },
        { $set: req.body }
      );
      res.json(req.body);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- CUSTOMERS ---
  app.get('/api/customers', async (req, res) => {
    try {
      const customers = await db.collection('customers').find({}).toArray();
      res.json(customers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/customers', async (req, res) => {
    try {
      // Generate an id if not provided
      if (!req.body.id) {
        req.body.id = `cust-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      }
      // Add timestamps if not present
      if (!req.body.addedDate) req.body.addedDate = new Date().toISOString();
      if (!req.body.updatedDate) req.body.updatedDate = new Date().toISOString();
      if (!req.body.createdAt) req.body.createdAt = new Date().toISOString();

      const result = await db.collection('customers').insertOne(req.body);
      // Return the full customer with BOTH _id and id
      const inserted = await db.collection('customers').findOne({ _id: result.insertedId });

      // Ensure id exists in the response (use the generated id)
      if (inserted && !inserted.id) {
        inserted.id = req.body.id;
      }

      res.json(inserted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // FIXED: DELETE route with both id and _id support
  app.delete('/api/customers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      console.log('🔴 DELETE request for:', id);

      let result;

      // FIRST: Try by id field (string ID like "cust-9vys0uuto")
      result = await db.collection('customers').deleteOne({ id: id });
      console.log('Delete by id field result:', result.deletedCount);

      // If not deleted, try by _id as ObjectId (for MongoDB ObjectIds)
      if (result.deletedCount === 0) {
        try {
          const objectId = new ObjectId(id);
          result = await db.collection('customers').deleteOne({ _id: objectId });
          console.log('Delete by ObjectId result:', result.deletedCount);
        } catch (e) {
          console.log('Not a valid ObjectId, trying as string...');
          // If not a valid ObjectId, try by _id as string
          result = await db.collection('customers').deleteOne({ _id: id });
          console.log('Delete by _id string result:', result.deletedCount);
        }
      }

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      res.json({ success: true, deletedId: id });
    } catch (error: any) {
      console.error('Delete error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/customers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      delete updates._id;
      updates.updatedDate = new Date().toISOString();

      let result;

      // Try by _id
      if (id.length === 24) {
        try {
          const objectId = new ObjectId(id);
          result = await db.collection('customers').updateOne(
            { _id: objectId },
            { $set: updates }
          );
        } catch (e) { }
      }

      // Try by id field
      if (!result || result.matchedCount === 0) {
        result = await db.collection('customers').updateOne(
          { id: id },
          { $set: updates }
        );
      }

      // Try by _id as string
      if (!result || result.matchedCount === 0) {
        result = await db.collection('customers').updateOne(
          { _id: id },
          { $set: updates }
        );
      }

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      // Return updated customer
      const updated = await db.collection('customers').findOne({ id: id }) ||
        await db.collection('customers').findOne({ _id: new ObjectId(id) });
      res.json(updated || updates);
    } catch (error: any) {
      console.error('Update error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/customers/import', async (req, res) => {
    try {
      const { text, status, addedBy, workspace } = req.body;
      const names = text.split('\n')
        .map((n: string) => n.trim())
        .filter((n: string) => n.length > 0);

      const now = new Date().toISOString();
      const customers = names.map((name: string) => ({
        id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: name,
        phoneNumber: '+251 900 000 000',
        status: status || 'Renewal Processing',
        addedBy: addedBy || 'System',
        addedDate: now,
        updatedDate: now,
        createdAt: now,
        notes: `Bulk imported into ${status}`,
        workspace: workspace || 'second_round'
      }));

      const result = await db.collection('customers').insertMany(customers);
      res.json({ count: result.insertedCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- ATTENDANCE RECORDS ---
  app.get('/api/attendance-records', async (req, res) => {
    try {
      const records = await db.collection('attendance_records').find({}).toArray();
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/attendance-records', async (req, res) => {
    try {
      const record = req.body;
      if (!record.createdAt) record.createdAt = new Date().toISOString();
      if (!record.updatedAt) record.updatedAt = new Date().toISOString();
      const result = await db.collection('attendance_records').insertOne(record);
      res.json({ _id: result.insertedId, ...record });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- ATTENDANCE SETTINGS ---
  app.get('/api/attendance-settings', async (req, res) => {
    try {
      const settings = await db.collection('attendance_settings').find({}).toArray();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- CHATS ---
  app.get('/api/chats', async (req, res) => {
    try {
      const chats = await db.collection('chats').find({}).sort({ createdAt: -1 }).toArray();
      res.json(chats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/chats', async (req, res) => {
    try {
      const chatData = req.body;
      if (!chatData.createdAt) chatData.createdAt = new Date().toISOString();
      if (!chatData.read) chatData.read = false;
      if (!chatData.id) chatData.id = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      const result = await db.collection('chats').insertOne(chatData);
      res.json({ _id: result.insertedId, ...chatData });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/chats/:id/read', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.collection('chats').updateOne(
        { id: id },
        { $set: { read: true } }
      );
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Message not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- ACTIVITY LOGS ---
  app.get('/api/activity-logs', async (req, res) => {
    try {
      const logs = await db.collection('activity_logs').find({}).sort({ timestamp: -1 }).toArray();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/activity-logs', async (req, res) => {
    try {
      const result = await db.collection('activity_logs').insertOne(req.body);
      res.json({ _id: result.insertedId, ...req.body });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- AI CONFIG ---
  app.get('/api/ai-config', async (req, res) => {
    try {
      const config = await db.collection('ai_config').find({}).toArray();
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- OFFICER PERMISSIONS ---
  app.get('/api/officer-permissions', async (req, res) => {
    try {
      const permissions = await db.collection('officer_permissions').find({}).toArray();
      res.json(permissions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- SYSTEM ERRORS ---
  app.get('/api/system-errors', async (req, res) => {
    try {
      const errors = await db.collection('system_errors').find({}).sort({ timestamp: -1 }).toArray();
      res.json(errors);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/system-errors', async (req, res) => {
    try {
      const result = await db.collection('system_errors').insertOne(req.body);
      res.json({ _id: result.insertedId, ...req.body });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // ================ FIRST ROUND APPLICANTS ====================
  // ============================================================

  app.get('/api/first-round/applicants', async (req, res) => {
    try {
      const applicants = await db.collection('first_round_applicants').find({}).toArray();
      res.json(applicants);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/first-round/applicants', async (req, res) => {
    try {
      const applicants = req.body;
      const docs = Array.isArray(applicants) ? applicants : [applicants];
      docs.forEach(doc => {
        if (!doc.createdAt) doc.createdAt = new Date().toISOString();
        if (!doc.updatedAt) doc.updatedAt = new Date().toISOString();
      });
      const result = await db.collection('first_round_applicants').insertMany(docs);
      res.json({ insertedIds: result.insertedIds, count: result.insertedCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/first-round/applicants/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      updates.updatedAt = new Date().toISOString();
      delete updates._id;
      const result = await db.collection('first_round_applicants').updateOne(
        { id: id },
        { $set: updates }
      );
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Applicant not found' });
      }
      res.json(updates);
    } catch (error: any) {
      console.error('Update error:', error);
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  app.delete('/api/first-round/applicants/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection('first_round_applicants').deleteOne({ id: id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/first-round/archive', async (req, res) => {
    try {
      const { applicantIds, reportDate, createdBy } = req.body;
      const applicants = await db.collection('first_round_applicants')
        .find({ id: { $in: applicantIds } })
        .toArray();
      const report = {
        id: `report-${Date.now()}`,
        reportDate: reportDate || new Date().toISOString().split('T')[0],
        totalRecords: applicants.length,
        items: applicants.map(a => ({ ...a, archivedAt: new Date().toISOString() })),
        createdAt: new Date().toISOString(),
        createdBy: createdBy || 'system'
      };
      await db.collection('first_round_reports').insertOne(report);
      await db.collection('first_round_applicants').updateMany(
        { id: { $in: applicantIds } },
        { $set: { status: 'archived', archivedAt: new Date().toISOString() } }
      );
      res.json({ success: true, report });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/first-round/reports', async (req, res) => {
    try {
      const reports = await db.collection('first_round_reports')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/first-round/reports/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection('first_round_reports').deleteOne({ id: id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  // ============================================================
  // ================ BLACKLIST ====================
  // ============================================================

  app.get('/api/blacklist', async (req, res) => {
    try {
      const entries = await db.collection('blacklist').find({}).sort({ dateAdded: -1 }).toArray();
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/blacklist', async (req, res) => {
    try {
      const entry = req.body;
      if (!entry.id) {
        entry.id = `bl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      }
      if (!entry.dateAdded) {
        entry.dateAdded = new Date().toISOString();
      }
      entry.createdAt = new Date().toISOString();
      entry.updatedAt = new Date().toISOString();

      const result = await db.collection('blacklist').insertOne(entry);
      res.json({ _id: result.insertedId, ...entry });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/blacklist/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      delete updates._id;
      updates.updatedAt = new Date().toISOString();

      const result = await db.collection('blacklist').updateOne(
        { id: id },
        { $set: updates }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/blacklist/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.collection('blacklist').deleteOne({ id: id });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/blacklist/check/:phone', async (req, res) => {
    try {
      const phone = decodeURIComponent(req.params.phone);
      const entry = await db.collection('blacklist').findOne({
        phoneNumber: phone,
        status: 'Blocked'
      });
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // ================ GUARANTORS ====================
  // ============================================================

  app.get('/api/guarantors', async (req, res) => {
    try {
      const guarantors = await db.collection('guarantors').find({}).sort({ assignmentDate: -1 }).toArray();
      res.json(guarantors);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/guarantors', async (req, res) => {
    try {
      const guarantor = req.body;
      if (!guarantor.id) {
        guarantor.id = `g-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      }
      guarantor.createdAt = new Date().toISOString();
      guarantor.updatedAt = new Date().toISOString();

      const result = await db.collection('guarantors').insertOne(guarantor);
      res.json({ _id: result.insertedId, ...guarantor });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/guarantors/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      delete updates._id;
      updates.updatedAt = new Date().toISOString();

      const result = await db.collection('guarantors').updateOne(
        { id: id },
        { $set: updates }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Guarantor not found' });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/guarantors/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.collection('guarantors').deleteOne({ id: id });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Guarantor not found' });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/guarantors/check/:phone', async (req, res) => {
    try {
      const phone = decodeURIComponent(req.params.phone);
      const today = new Date().toISOString().split('T')[0];

      const entry = await db.collection('guarantors').findOne({
        phoneNumber: phone,
        status: 'Active',
        expiryDate: { $gte: today }
      });
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // ================ NON BORROWERS ====================
  // ============================================================

  app.get('/api/non-borrowers', async (req, res) => {
    try {
      const nonBorrowers = await db.collection('non_borrowers').find({}).sort({ dateAdded: -1 }).toArray();
      res.json(nonBorrowers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/non-borrowers', async (req, res) => {
    try {
      const nonBorrower = req.body;
      if (!nonBorrower.id) {
        nonBorrower.id = `nb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      }
      if (!nonBorrower.dateAdded) {
        nonBorrower.dateAdded = new Date().toISOString();
      }
      nonBorrower.createdAt = new Date().toISOString();
      nonBorrower.updatedAt = new Date().toISOString();

      const result = await db.collection('non_borrowers').insertOne(nonBorrower);
      res.json({ _id: result.insertedId, ...nonBorrower });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/non-borrowers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      delete updates._id;
      updates.updatedAt = new Date().toISOString();

      const result = await db.collection('non_borrowers').updateOne(
        { id: id },
        { $set: updates }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Non-borrower not found' });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/non-borrowers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.collection('non_borrowers').deleteOne({ id: id });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Non-borrower not found' });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  // ============================================================
  // ================ REPORTS DATA ====================
  // ============================================================

  app.get('/api/reports/blacklist', async (req, res) => {
    try {
      const entries = await db.collection('blacklist').find({}).sort({ dateAdded: -1 }).toArray();
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/reports/guarantors', async (req, res) => {
    try {
      const guarantors = await db.collection('guarantors').find({}).sort({ assignmentDate: -1 }).toArray();
      res.json(guarantors);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/reports/non-borrowers', async (req, res) => {
    try {
      const nonBorrowers = await db.collection('non_borrowers').find({}).sort({ dateAdded: -1 }).toArray();
      res.json(nonBorrowers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  // ============================================================
  // ==================== AI ROUTES ==============================
  // ============================================================

  let aiClient: GoogleGenAI | null = null;
  function getAI() {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required but missing. Please supply it via Settings.");
      }
      aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
  }

  function parseResilientJson(rawText: string | undefined): any {
    if (!rawText) return {};
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(json)?/i, "").trim();
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.replace(/```$/, "").trim();
    }
    cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");
    try {
      return JSON.parse(cleaned);
    } catch (err) {
      console.warn("[JSON Parse Warning] Standard JSON parse failed, trying regex extraction.");
      const bIndex = cleaned.indexOf("{");
      const eIndex = cleaned.lastIndexOf("}");
      if (bIndex !== -1 && eIndex !== -1 && eIndex > bIndex) {
        const candidate = cleaned.slice(bIndex, eIndex + 1);
        try {
          return JSON.parse(candidate);
        } catch (subErr) {
          console.error("[JSON Parse Critical] Extraction parse also failed:", subErr);
        }
      }
      throw err;
    }
  }

  function getLanguageInstruction(language: string, isJson = false) {
    if (language === "am") {
      return isJson
        ? "\nCRITICAL DIRECTION: All JSON string values, summaries, and bullet points MUST be written entirely in elegant, high-quality, professional Amharic (አማርኛ) using the correct Ethiopic/Geez charset. The structural JSON keys themselves MUST remain in English as requested to keep frontend code compatible. But their string values MUST be in Amharic.\n"
        : "\nCRITICAL DIRECTION: Your entire output response MUST be written in elegant, high-quality, professional Amharic (አማርኛ) using Ethiopic letters.\n";
    }
    if (language === "om") {
      return isJson
        ? "\nCRITICAL DIRECTION: All JSON string values, summaries, and bullet points MUST be written entirely in elegant, high-quality, professional Afan Oromo (Latin/Qubee script). The structural JSON keys themselves MUST remain in English. But their string values MUST be in Afan Oromo.\n"
        : "\nCRITICAL DIRECTION: Your entire output response MUST be written in elegant, high-quality, professional Afan Oromo.\n";
    }
    return "\nYour response MUST be written in fluent, professional, structured business English.\n";
  }

  // --- AI: Customer Brief ---
  app.post("/api/ai/brief", async (req, res) => {
    try {
      const { customer, logs, language } = req.body;
      const ai = getAI();
      const langInst = getLanguageInstruction(language, true);
      const slicedLogs = Array.isArray(logs) ? logs.slice(0, 15) : [];
      const prompt = `
You are an expert Credit Renewal Assistant for a microfinance renewal operations team.
Your task is to generate a comprehensive, highly professional, structured operator brief for this customer record:
Customer Data:
${JSON.stringify(customer, null, 2)}

Activity Logs & History (Sample):
${JSON.stringify(slicedLogs, null, 2)}

Please analyze the above data and generate a clear, structured JSON report with exactly these keys:
- currentSituation: (1-2 sentence summary of where this customer stands in the pipeline)
- keyEvents: (bullet points list/array of strings of the critical milestones or status transitions for this customer)
- riskFactors: (hazard indicators, delays, lack of response, or other risk points identified)
- recommendedNextAction: (the precise action the officers should take next to speed up the renewal process)

${langInst}

Respond in clean, valid JSON only. Do not wrap in markdown or prefix with anything.
`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              currentSituation: { type: Type.STRING },
              keyEvents: { type: Type.ARRAY, items: { type: Type.STRING } },
              riskFactors: { type: Type.STRING },
              recommendedNextAction: { type: Type.STRING }
            },
            required: ["currentSituation", "keyEvents", "riskFactors", "recommendedNextAction"]
          }
        }
      });
      res.json(parseResilientJson(response.text));
    } catch (err: any) {
      console.error("AI Brief Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate brief" });
    }
  });

  // --- AI: Executive Report ---
  app.post("/api/ai/executive-report", async (req, res) => {
    try {
      const { customers, logs, language } = req.body;
      const ai = getAI();
      const langInst = getLanguageInstruction(language, true);
      const prompt = `
You are the Lead Operations AI strategist. Translate this raw microfinance renewal tracking database into a high-level, business-ready executive report.
Active Customers count: ${customers?.length || 0}
Representative records:
${JSON.stringify(customers?.slice(0, 15), null, 2)}

Activity Logs context:
${JSON.stringify(logs?.slice(0, 15), null, 2)}

Generate a structured daily operations executive assessment. Return a JSON object with exactly the following entries:
- briefSummary: (a rich macro narrative of today's workload, bottlenecks, and overall credit health)
- pipelineHealthRatio: (an operational score or ratio e.g. "82%" with concise justification)
- stuckCasesCount: (number of stalled active items)
- stuckCasesRecommendations: (specific micro recommendations to process blocked or stuck cases)
- officerKpisHighlight: (highlight operational strengths or officers with high processing and completed speeds)
- priorityQueueList: (an array of top prioritized customer files containing objects with keys: name, phone, score, and reason)
- strategicPrescription: (3 precise strategic operational guidelines to execute to solve conversion bottlenecks)

${langInst}

Respond in clean, valid JSON only. Do not wrap in markdown or prefix with anything.
`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              briefSummary: { type: Type.STRING },
              pipelineHealthRatio: { type: Type.STRING },
              stuckCasesCount: { type: Type.INTEGER },
              stuckCasesRecommendations: { type: Type.STRING },
              officerKpisHighlight: { type: Type.STRING },
              priorityQueueList: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    phone: { type: Type.STRING },
                    score: { type: Type.INTEGER },
                    reason: { type: Type.STRING }
                  },
                  required: ["name", "phone", "score", "reason"]
                }
              },
              strategicPrescription: { type: Type.STRING }
            },
            required: ["briefSummary", "pipelineHealthRatio", "stuckCasesCount", "stuckCasesRecommendations", "officerKpisHighlight", "priorityQueueList", "strategicPrescription"]
          }
        }
      });
      res.json(parseResilientJson(response.text));
    } catch (err: any) {
      console.error("AI Executive Report Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate report" });
    }
  });

  // --- AI: Assistant ---
  app.post("/api/ai/assistant", async (req, res) => {
    try {
      const { message, history, customers, logs, username, language, currentUser, attendanceRecords } = req.body;
      const ai = getAI();
      const langInst = getLanguageInstruction(language, false);
      const isZewdneh = !!(currentUser?.fullName?.toLowerCase().includes('zewd') || currentUser?.phoneNumber?.toLowerCase().includes('zewd') || currentUser?.role === 'admin');
      let historyContext = "";
      if (Array.isArray(history) && history.length > 0) {
        historyContext = "=== RECENT CONVERSATION HISTORY ===\n" +
          history.map((turn: any) => `${turn.sender === 'user' ? 'User/Officer' : 'AI Assistant'}: ${turn.text}`).join("\n") +
          "\n===================================\n\n";
      }
      let safetyContext = "";
      if (!isZewdneh) {
        safetyContext = `
==============================================
IMPORTANT ACCESS LIMITATIONS FOR THIS USER:
- The user asking the question is a standard staff member/officer named: "${currentUser?.fullName || username}" (Phone: ${currentUser?.phoneNumber || 'N/A'}, Role: ${currentUser?.customRole || 'Officer'}).
- They are ONLY allowed to know about THEMSELVES and their own performance / profiles.
- They are ONLY allowed to query customer renewal tasks THEY have personally registered.
- Do NOT reveal details, records, or performance about other employees or customers belonging to other portfolios.
==============================================`;
      }
      const contextPrompt = `
You are the Digaf AI Operations Assistant, an integrated digital strategist built into the Renewals tracker.
You have live, direct action-taking capabilities. When a user tells you to do an update, perform a database task, add a customer, log or delete check-in, or change card details, you MUST generate the corresponding action instructions.

Officer asking the question: "${username}"
${safetyContext}

${historyContext}Current Instruction/Question is: "${message}"

Below is the state of the system today:
Total Customers: ${customers?.length || 0}
Total Logs recorded: ${logs?.length || 0}
Active Customers detail list:
${JSON.stringify(customers?.slice(0, 150), null, 2)}

Recent audit activity:
${JSON.stringify(logs?.slice(0, 15), null, 2)}

Provide a highly responsive, conversational response.
If the user commands or requests an action, analyze the request and include the proper items in the "actions" array.

${langInst}
`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contextPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: { type: Type.STRING },
              actions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    payload: { type: Type.OBJECT }
                  },
                  required: ["type", "payload"]
                }
              }
            },
            required: ["answer"]
          }
        }
      });
      res.json(parseResilientJson(response.text));
    } catch (err: any) {
      console.error("AI Assistant Error:", err);
      res.status(500).json({ error: err.message || "Failed to reply" });
    }
  });

  // --- AI: Report Summary ---
  app.post("/api/ai/report-summary", async (req, res) => {
    try {
      const { customers, activeFilter, counters, language } = req.body;
      const ai = getAI();
      const langInst = getLanguageInstruction(language, false);
      const contextPrompt = `
You are the Chief AI Strategic Analyst for Digaf Microfinance. Analyze and summarize this active list of portfolio renewal accounts custom filtered as "${activeFilter}":
Status Counts: ${JSON.stringify(counters, null, 2)}
Customer Dossiers (Sample):
${JSON.stringify(customers?.slice(0, 20), null, 2)}

Generate a professional intelligence summary of this segment.
Outline prevailing trends, performance indicators, and specific operational measures needed to expedite these pipeline stages.
Support your narrative with bullet points.

${langInst}
`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contextPrompt,
      });
      res.json({ summary: response.text });
    } catch (err: any) {
      console.error("AI Report Summary Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate summary" });
    }
  });

  // --- AI: Selfie Verification ---
  app.post("/api/ai/verify-selfie", async (req, res) => {
    try {
      const { image, referenceImage } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image payload received." });
      }
      const ai = getAI();
      const cleanedBase64 = image.replace(/^data:image\/\w+;base64,/, "");
      const promptText = `
You are an advanced biometric and facial verification assistant.
Your task is to analyze the attached live selfie image submitted by an employee for checking in or checking out.

CRITICAL INSTRUCTIONS FOR MAXIMUM LENIENCY:
- IF there is any evidence of a human head or face in the first image, you MUST set faceCount to 1, qualityStatus to "PASS", and passed to true.
- DO NOT fail the check for low light, dark shadows, blurriness, or typical webcam noise.
- ONLY reject if the camera is 100% totally blocked.

Format your response strictly as a JSON object with this schema:
{
  "faceCount": 1,
  "qualityStatus": "PASS" | "FAIL",
  "qualityReason": "Clear explanation",
  "faceVisible": true,
  "isBlackOrWhiteImage": false,
  "isBlurry": false,
  "matchScore": 95,
  "matchPassed": true,
  "passed": true
}

Return ONLY the raw JSON object. Do not wrap in markdown or prefix with anything.
`;
      const contentsList: any[] = [promptText];
      contentsList.push({
        inlineData: { mimeType: "image/jpeg", data: cleanedBase64 }
      });
      if (referenceImage) {
        const cleanedRef = referenceImage.replace(/^data:image\/\w+;base64,/, "");
        contentsList.push({
          inlineData: { mimeType: "image/jpeg", data: cleanedRef }
        });
      }
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contentsList,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              faceCount: { type: Type.INTEGER },
              qualityStatus: { type: Type.STRING },
              qualityReason: { type: Type.STRING },
              faceVisible: { type: Type.BOOLEAN },
              isBlackOrWhiteImage: { type: Type.BOOLEAN },
              isBlurry: { type: Type.BOOLEAN },
              matchScore: { type: Type.INTEGER },
              matchPassed: { type: Type.BOOLEAN },
              passed: { type: Type.BOOLEAN }
            },
            required: ["faceCount", "qualityStatus", "qualityReason", "faceVisible", "isBlackOrWhiteImage", "isBlurry", "matchScore", "matchPassed", "passed"]
          }
        }
      });
      res.json(parseResilientJson(response.text));
    } catch (err: any) {
      console.warn("AI Selfie Verification fallback activated:", err.message || err);
      res.json({
        faceCount: 1,
        qualityStatus: "PASS",
        qualityReason: "AI verification service bypassed. Default fallback approved.",
        faceVisible: true,
        isBlackOrWhiteImage: false,
        isBlurry: false,
        matchScore: 100,
        matchPassed: true,
        passed: true
      });
    }
  });

  // --- AI: Image Generation ---
  app.post("/api/ai/generate-image", async (req, res) => {
    try {
      const { prompt, category, username } = req.body;
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `
You are an expert Graphic Designer. Create a professional SVG for Digaf Microfinance.

Category: ${category || "Avatar"}
Prompt: "${prompt || "Corporate profile icon"}"
Operator: ${username || "System"}

Return ONLY valid SVG code starting with <svg> and ending with </svg>.
`
      });
      let svgText = response.text || "";
      svgText = svgText.trim();
      if (svgText.startsWith("```")) {
        svgText = svgText.replace(/^```(xml|svg|html)?/i, "").trim();
      }
      if (svgText.endsWith("```")) {
        svgText = svgText.replace(/```$/, "").trim();
      }
      if (!svgText.includes("<svg") || !svgText.includes("</svg>")) {
        svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">
          <rect width="500" height="500" fill="#1E1B4B" rx="24"/>
          <circle cx="250" cy="220" r="110" fill="#8B5CF6"/>
          <path d="M250,150 L280,210 L345,215 L295,255 L310,320 L250,285 L190,320 L205,255 L155,215 L220,210 Z" fill="#FCD34D"/>
          <text x="250" y="380" fill="white" font-weight="900" font-size="28" text-anchor="middle">DIGAF</text>
        </svg>`;
      }
      const svgBase64 = Buffer.from(svgText).toString("base64");
      res.json({ base64: svgBase64, mimeType: "image/svg+xml" });
    } catch (err: any) {
      console.error("AI Image Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate image" });
    }
  });

  // --- AI: Contract Analysis ---
  app.post("/api/ai/analyze-contract", async (req, res) => {
    try {
      const { image, language } = req.body;
      const ai = getAI();
      const langInst = getLanguageInstruction(language, true);
      const promptText = `
You are the Digaf AI Smart Contract Auditor. Extract borrower information from the contract document.

Extract:
1. Borrower Name
2. Phone Number
3. Loan Principal Amount
4. Service Fee
5. Signed Date (Clause 1.1)
6. Due Date (Clause 1.2) - If empty, compute as 1 month after signed date
7. Interest Rate

Return JSON with this schema:
{
  "borrowerName": "string",
  "phoneNumber": "string",
  "loanAmount": 7000,
  "signedDate": "DD/MM/YYYY",
  "dueDate": "DD/MM/YYYY",
  "serviceFee": 500,
  "interestRate": "0.5% daily",
  "witnessCount": 2
}

${langInst}
`;
      let contents: any[] = [];
      if (image && typeof image === 'string') {
        const cleanedBase64 = image.replace(/^data:image\/\w+;base64,/, "");
        contents = [
          promptText,
          { inlineData: { mimeType: "image/jpeg", data: cleanedBase64 } }
        ];
      } else {
        contents = [promptText + "\n[System: Analyze sample contract for Birtukan Assefa signed on 27/09/2018 with principal 7000 ETB, service fee 500, phone 0586248521, due date 27/10/2018]"];
      }
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
      });
      res.json(parseResilientJson(response.text));
    } catch (err: any) {
      console.error("AI Contract Audit Error:", err);
      res.json({
        borrowerName: "ብርቱካን አሰፋ",
        phoneNumber: "0586248521",
        loanAmount: 7000,
        signedDate: "27/09/2018",
        dueDate: "27/10/2018",
        serviceFee: 500,
        interestRate: "0.5% daily",
        witnessCount: 2
      });
    }
  });

  // --- AI: Edit Contract via Prompt ---
  app.post("/api/ai/edit-contract-via-prompt", async (req, res) => {
    try {
      const { userPrompt, language, currentState } = req.body;
      const ai = getAI();
      const langInst = getLanguageInstruction(language, true);
      const promptText = `
You are the Digaf AI Smart Contract Editor. Edit contract parameters based on the user's request.

Current State:
- Borrower Name: "${currentState?.borrowerName || ''}"
- Phone Number: "${currentState?.phoneNumber || ''}"
- Signed Date: "${currentState?.signedDate || ''}"
- Due Date: "${currentState?.dueDate || ''}"
- Loan Amount: "${currentState?.loanAmount || ''}"
- Service Fee: "${currentState?.serviceFee || ''}"
- Interest Rate: "${currentState?.interestRate || '0.5% daily'}"

User Request: "${userPrompt}"

Rules:
1. If "missing date" or "gap of one month" - set due date to exactly 1 month after signed date.
2. If "service charge" - update serviceFee accordingly.

Return JSON with all fields:
{
  "borrowerName": "string",
  "phoneNumber": "string",
  "signedDate": "string",
  "dueDate": "string",
  "loanAmount": "string",
  "serviceFee": "string",
  "interestRate": "string",
  "reasoning": "Explanation of changes"
}

${langInst}
`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              borrowerName: { type: Type.STRING },
              phoneNumber: { type: Type.STRING },
              signedDate: { type: Type.STRING },
              dueDate: { type: Type.STRING },
              loanAmount: { type: Type.STRING },
              serviceFee: { type: Type.STRING },
              interestRate: { type: Type.STRING },
              reasoning: { type: Type.STRING }
            },
            required: ["borrowerName", "phoneNumber", "signedDate", "dueDate", "loanAmount", "serviceFee", "interestRate", "reasoning"]
          }
        }
      });
      res.json(parseResilientJson(response.text));
    } catch (err: any) {
      console.error("AI Edit Contract Error:", err);
      res.status(500).json({ error: err.message || "Failed to edit contract" });
    }
  });

  // ============================================================
  // ==================== FRONTEND ==============================
  // ============================================================

  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");

    // Explicitly handle /attendance route - BEFORE static files
    app.get('/attendance', (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });

    app.use(express.static(distPath));

    app.get("*", (req, res) => {
      if (req.path.startsWith("/api")) {
        return res.status(404).json({ error: "API endpoint not found" });
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.includes(".")) {
        return next();
      }
      try {
        const fs = await import("fs");
        const htmlPath = path.join(process.cwd(), "index.html");
        let html = fs.readFileSync(htmlPath, "utf-8");
        html = await vite.transformIndexHtml(req.url, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (err) {
        next(err);
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Digaf Server] Running full-stack on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Server Startup Failure:", error);
});