const express = require("express");

const cors = require("cors");

const dotenv = require("dotenv");

const cookieParser = require("cookie-parser");

const jwt = require("jsonwebtoken");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",

    credentials: true,
  }),
);

app.use(cookieParser());

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

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).send({
      message: "unauthorized access",
    });
  }

  jwt.verify(
    token,

    process.env.JWT_SECRET,

    (error, decoded) => {
      if (error) {
        return res.status(401).send({
          message: "unauthorized access",
        });
      }

      req.decoded = decoded;

      next();
    },
  );
};

async function run() {
  try {
    const database = client.db("pawHavenDB");
    const petsCollection = database.collection("pets");
    const requestsCollection = database.collection("requests");
    const usersCollection = database.collection("users");

    app.get("/", (req, res) => {
      res.send("PawHaven Server Running...");
    });

    app.post("/jwt", async (req, res) => {
      const user = req.body;

      const token = jwt.sign(
        user,

        process.env.JWT_SECRET,

        {
          expiresIn: "7d",
        },
      );

      res
        .cookie("token", token, {
          httpOnly: true,

          secure: false,

          sameSite: "strict",
        })

        .send({
          success: true,
        });
    });

    app.post("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: false,
          sameSite: "strict",
        })

        .send({
          success: true,
        });
    });

    app.post("/pets", verifyToken, async (req, res) => {
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

    app.get("/pets", async (req, res) => {
      const search = req.query.search || "";

      const species = req.query.species || "";

      const query = {};

      if (search) {
        query.petName = {
          $regex: search,

          $options: "i",
        };
      }

      if (species) {
        const speciesArray = species.split(",");

        query.species = {
          $in: speciesArray,
        };
      }

      const result = await petsCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();

      res.send(result);
    });

    app.get("/pets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const query = {
        _id: new ObjectId(id),
      };

      const result = await petsCollection.findOne(query);

      res.send(result);
    });

    app.get("/my-pets", verifyToken, async (req, res) => {
      const email = req.query.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({
          message: "forbidden access",
        });
      }

      const query = {
        ownerEmail: email,
      };

      const result = await petsCollection.find(query).toArray();

      res.send(result);
    });

    app.delete("/pets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const query = {
        _id: new ObjectId(id),
      };

      const result = await petsCollection.deleteOne(query);

      res.send(result);
    });

    app.patch("/pets/:id", verifyToken, async (req, res) => {
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

    app.post("/requests", verifyToken, async (req, res) => {
      const requestData = req.body;

      const result = await requestsCollection.insertOne(requestData);

      res.send(result);
    });
    app.get("/requests", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({
          message: "forbidden access",
        });
      }
      const query = {
        requesterEmail: email,
      };
      const result = await requestsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/requests/check", async (req, res) => {
      const { petId, email } = req.query;
      const query = {
        petId,
        requesterEmail: email,
      };

      const existingRequest = await requestsCollection.findOne(query);
      res.send({
        exists: !!existingRequest,
      });
    });

    app.get("/pet-requests/:id", verifyToken, async (req, res) => {
      const petId = req.params.id;

      const result = await requestsCollection
        .find({
          petId,
        })
        .toArray();

      res.send(result);
    });

    app.patch("/requests/status/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { status, petId } = req.body;
      const existingRequest = await requestsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!existingRequest) {
        return res.send({
          message: "Request not found",
        });
      }

      if (existingRequest.status === "approved") {
        return res.send({
          message: "Request already approved",
        });
      }

      if (existingRequest.status === "rejected") {
        return res.send({
          message: "Request already rejected",
        });
      }

      const query = {
        _id: new ObjectId(id),
      };

      const updatedDoc = {
        $set: {
          status,
        },
      };

      const result = await requestsCollection.updateOne(query, updatedDoc);

      if (status === "approved") {
        await petsCollection.updateOne(
          {
            _id: new ObjectId(petId),
          },

          {
            $set: {
              status: "adopted",
            },
          },
        );

        await requestsCollection.updateMany(
          {
            petId,

            status: "pending",
          },

          {
            $set: {
              status: "rejected",
            },
          },
        );
      }

      res.send(result);
    });

    app.delete("/requests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const request = await requestsCollection.findOne({
        _id: new ObjectId(id),
      });
      if (request?.status === "approved") {
        return res.send({
          message: "Approved request cannot be canceled",
        });
      }
      const result = await requestsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.get("/featured-pets", async (req, res) => {
      const result = await petsCollection

        .find({
          status: {
            $in: ["available", "Available"],
          },
        })

        .sort({
          _id: -1,
        })

        .limit(6)

        .toArray();

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
