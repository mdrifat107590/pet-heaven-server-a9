const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
dotenv.config();
const app = express();
app.use(cors());

app.use(express.json());
const port = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const database = client.db("pawHavenDB");
    const petsCollection = database.collection("pets");
    const requestsCollection = database.collection("requests");
    const usersCollection = database.collection("users");

    app.get("/", (req, res) => {
      res.send("PawHaven Server Running...");
    });
    // post a pet
    app.post("/pets", async (req, res) => {
      try {
        const petData = req.body;
        const result = await petsCollection.insertOne(petData);
        res.send({
          success: true,
          result,
        });
      } catch (error) {
        res.send({
          success: false,
          message: error.message,
        });
      }
    });
    // get all pets
    app.get("/pets", async (req, res) => {
      const result = await petsCollection.find().toArray();

      res.send(result);
    });
    // single pet
    app.get("/pets/:id", async (req, res) => {
      const id = req.params.id;

      const query = {
        _id: new ObjectId(id),
      };

      const result = await petsCollection.findOne(query);

      res.send(result);
    });

    // my listing api
    app.get("/my-pets", async (req, res) => {
      const email = req.query.email;

      const query = {
        ownerEmail: email,
      };

      const result = await petsCollection.find(query).toArray();

      res.send(result);
    });

    // delete pet
    app.delete("/pets/:id", async (req, res) => {
      const id = req.params.id;

      const query = {
        _id: new ObjectId(id),
      };

      const result = await petsCollection.deleteOne(query);

      res.send(result);
    });

    // update pet api
    app.patch("/pets/:id", async (req, res) => {
      const id = req.params.id;

      const updatedData = req.body;

      const query = {
        _id: new ObjectId(id),
      };

      const updatedDoc = {
        $set: updatedData,
      };

      const result = await petsCollection.updateOne(query, updatedDoc);

      res.send(result);
    });
    await client.connect();
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.log(error);
  }
}
run();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
