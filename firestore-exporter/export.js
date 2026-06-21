const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");

initializeApp({ projectId: "chromatic-wonder-f6tp2" });
const db = getFirestore("ai-studio-a554033b-9391-4db2-b72e-932986c8ab00");

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

async function exportCollections() {
  for (const col of collections) {
    console.log(`Exporting ${col}...`);
    try {
      const snapshot = await db.collection(col).get();
      const data = {};
      snapshot.forEach(doc => {
        data[doc.id] = doc.data();
      });
      fs.writeFileSync(`${col}.json`, JSON.stringify(data, null, 2));
      console.log(`Successfully saved ${col}.json`);
    } catch (err) {
      console.error(`Error exporting ${col}:`, err.message);
    }
  }
}
exportCollections();