import { MongoClient } from "mongodb";

const uri =
"mongodb://Digaf_MFI:erCb6Ucnq5pNBS3K@ac-nkqt4y6-shard-00-00.yiz1p7x.mongodb.net:27017,ac-nkqt4y6-shard-00-01.yiz1p7x.mongodb.net:27017,ac-nkqt4y6-shard-00-02.yiz1p7x.mongodb.net:27017/?ssl=true&replicaSet=atlas-fqjsli-shard-0&authSource=admin&retryWrites=true&w=majority";

async function run() {
  try {
    const client = new MongoClient(uri);

    await client.connect();

    console.log("CONNECTED SUCCESSFULLY");

    await client.db("admin").command({ ping: 1 });

    console.log("PING SUCCESSFUL");

    await client.close();
  } catch (err) {
    console.error("TEST ERROR:", err);
  }
}

run();