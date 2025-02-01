import express from "express";
import cors from "cors";
import multer from "multer";
import AWS from "aws-sdk";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import http from "http";

//* Load environment variables from .env file
dotenv.config();

//* Configure AWS SDK & S3 bucket & port
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const bucketName = process.env.AWS_BUCKET_NAME;
const PORT = process.env.PORT || 5000;

// console.log("AWS_BUCKET_NAME", process.env.AWS_ACCESS_KEY_ID);
// console.log("AWS_SECRET_ACCESS_KEY", process.env.AWS_SECRET_ACCESS_KEY);
// console.log("AWS_REGION", process.env.AWS_REGION);
// console.log("AWS_BUCKET_NAME", process.env.AWS_BUCKET_NAME);

//* Create Express app
const app = express();
app.use(express.json({ limit: "200mb" })); // Increase limit
app.use(express.urlencoded({ limit: "200mb", extended: true }));

//* Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = ["https://3d-web-app-three.vercel.app", "http://localhost:5173"];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin); // ✅ Set the correct origin dynamically
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);


app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // ✅ Allow any origin (Change if needed)
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

//* Multer upload middleware for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage to keep file in memory before upload
  limits: { fileSize: 200 * 1024 * 1024 }, // Increase to 200MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "model/gltf-binary", // .glb
      "model/gltf+json", // .gltf
      "model/stl", // .stl
      "model/obj", // .obj
      "model/mtl", // .mtl
      "model/vnd.collada+xml", // .dae
      "application/octet-stream", // Generic binary files (e.g., .bin)
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(
        new Error(
          "Unsupported file type. Allowed formats are: .glb, .gltf, .stl, .obj, .mtl, .dae"
        ),
        false
      );
    }
    cb(null, true);
  },
});

//* Example API endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ message: "CORS configuration works!" });
});

//* Upload endpoint
app.post("/api/upload", upload.single("model"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const params = {
    Bucket: bucketName,
    Key: file.originalname, // Use original file name
    Body: file.buffer, // File buffer from Multer
    ContentType: file.mimetype, // File MIME type
    ACL: "public-read", // Allow read access to this file
  };

  try {
    const uploadResult = await s3.upload(params, { partSize: 10 * 1024 * 1024 }).promise(); // 10MB per part

    console.log("File uploaded to S3:", uploadResult.Location);
    res.status(200).json({ url: uploadResult.Location });
  } catch (uploadError) {
    console.error("S3 Upload Error:", uploadError);
    res.status(500).json({ error: "Failed to upload to S3" });
  }
});

//* Load endpoint
app.get("/api/load", async (req, res) => {
  try {
    const params = { Bucket: bucketName };
    const data = await s3.listObjectsV2(params).promise();

    const files = data.Contents.map((item) => ({
      name: item.Key,
      url: `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`,
    }));
    console.log("files", files);
    res.status(200).json(files);
  } catch (error) {
    console.error("S3 List Error:", error);
    res.status(500).json({ error: "Failed to list files" });
  }
});

//* Delete endpoint
app.delete("/api/uploads/:filename", async (req, res) => {
  const { filename } = req.params;

  if (!filename) {
    return res.status(400).json({ error: "Filename is required" });
  }

  try {
    const params = { Bucket: bucketName, Key: filename };
    await s3.deleteObject(params).promise();

    console.log("File deleted:", params);
    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("S3 Delete Error:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

app.get("/api/uploads/:filename", async (req, res) => {
  const { filename } = req.params;

  if (!filename) {
    return res.status(400).json({ error: "Filename is required" });
  }

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: filename,
    Expires: 3600, // URL expiration time in seconds
  };

  try {
    const url = s3.getSignedUrl("getObject", params);
    res.json({ url });
  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    res.status(500).send("Failed to generate URL.");
  }
});

//* Create HTTP server and attach Express app && Create WebSocket server
// const server = http.createServer(app);
// const wss = new WebSocketServer({ server });

//* Handle WebSocket connections
// wss.on("connection", (ws) => {
//   console.log("New WebSocket connection");

//* Keep the connection alive with a ping
//   const interval = setInterval(() => {
//     if (ws.readyState === WebSocket.OPEN) {
//       ws.send(JSON.stringify({ type: "PING" }));
//     }
//   }, 30000); // Send a ping every 30 seconds

//   ws.on("message", (message) => {
//     console.log("Received message:", message);
//   });

//   ws.on("close", (code, reason) => {
//     console.log("WebSocket connection closed:", { code, reason });
//     clearInterval(interval); // Clear interval on close
//   });

//   ws.on("error", (error) => {
//     console.error("WebSocket error:", error);
//   });
// });

//* Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
