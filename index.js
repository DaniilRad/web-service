import express from "express";
import cors from "cors";
import multer from "multer";
import AWS from "aws-sdk";

import dotenv from "dotenv";
dotenv.config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_BUCKET_NAME;

console.log("AWS_BUCKET_NAME", process.env.AWS_ACCESS_KEY_ID);
console.log("AWS_SECRET_ACCESS_KEY", process.env.AWS_SECRET_ACCESS_KEY);
console.log("AWS_REGION", process.env.AWS_REGION);
console.log("AWS_BUCKET_NAME", process.env.AWS_BUCKET_NAME);
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage to keep file in memory before upload
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

// Upload endpoint
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
  };

  try {
    const uploadResult = await s3.upload(params).promise();
    res.status(200).json({ url: uploadResult.Location });
  } catch (uploadError) {
    console.error("S3 Upload Error:", uploadError);
    res.status(500).json({ error: "Failed to upload to S3" });
  }
});

// Load endpoint
app.get("/api/load", async (req, res) => {
  try {
    const params = { Bucket: bucketName };
    const data = await s3.listObjectsV2(params).promise();

    const files = data.Contents.map((item) => ({
      name: item.Key,
      url: `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`,
    }));

    res.status(200).json(files);
  } catch (error) {
    console.error("S3 List Error:", error);
    res.status(500).json({ error: "Failed to list files" });
  }
});

// Delete endpoint
app.delete("/api/uploads/:filename", async (req, res) => {
  const { filename } = req.params;

  if (!filename) {
    return res.status(400).json({ error: "Filename is required" });
  }

  try {
    const params = { Bucket: bucketName, Key: filename };
    await s3.deleteObject(params).promise();

    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("S3 Delete Error:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;


// import express from "express";
// import cors from "cors";
// import multer from "multer";
// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const app = express();
// const PORT = process.env.PORT || 5000;

// // Middleware
// app.use(cors());

// // Set up Multer for file upload
// const upload = multer({
//   storage: multer.diskStorage({
//     destination: (req, file, cb) => {
//       const uploadDir = "./uploads";
//       if (!fs.existsSync(uploadDir)) {
//         fs.mkdirSync(uploadDir); // Create uploads directory if it doesn't exist
//       }
//       cb(null, uploadDir); // Save files to the ./uploads directory
//     },
//     filename: (req, file, cb) => {
//       cb(null, file.originalname); // Use original file name
//     },
//   }),
//   fileFilter: (req, file, cb) => {
//     const allowedMimes = [
//       "model/gltf-binary", // .glb
//       "model/gltf+json", // .gltf
//       "model/stl", // .stl
//       "model/obj", // .obj
//       "model/mtl", // .mtl
//       "model/vnd.collada+xml", // .dae
//       "application/octet-stream", // Generic binary files (e.g., .bin)
//     ];
//     if (!allowedMimes.includes(file.mimetype)) {
//       return cb(
//         new Error(
//           "Unsupported file type. Allowed formats are: .glb, .gltf, .stl, .obj, .mtl, .dae"
//         ),
//         false
//       );
//     }
//     cb(null, true);
//   },
// });

// // Upload endpoint: Save files locally
// app.post("/api/upload", upload.single("model"), (req, res) => {
//   const file = req.file;

//   if (!file) {
//     return res.status(400).json({ error: "No file uploaded" });
//   }

//   console.log(`File uploaded locally: ${file.path}`);
//   res.status(200).json({ message: "File uploaded successfully", filePath: file.path });
// });

// // Load endpoint: List files saved locally
// app.get("/api/load", (req, res) => {
//   const uploadDir = "./uploads";

//   if (!fs.existsSync(uploadDir)) {
//     return res.status(200).json([]); // Return an empty list if no files exist
//   }

//   const files = fs.readdirSync(uploadDir).map((fileName) => ({
//     name: fileName,
//     path: path.join(uploadDir, fileName),
//     url: `http://localhost:${PORT}/uploads/${fileName}`, // Serve files from uploads directory
//   }));

//   res.status(200).json(files);
// });

// // Serve static files in the uploads directory
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// // Delete endpoint: Delete files locally
// app.delete("/api/uploads/:filename", (req, res) => {
//   const { filename } = req.params;
//   const filePath = path.join("./uploads", filename);

//   if (!fs.existsSync(filePath)) {
//     return res.status(404).json({ error: "File not found" });
//   }

//   fs.unlinkSync(filePath); // Delete the file
//   console.log(`File deleted: ${filePath}`);
//   res.status(200).json({ message: "File deleted successfully" });
// });

// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

// export default app;
