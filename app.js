const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const WebSocket = require("ws"); // Import WebSocket

const app = express();
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// Enable CORS for the frontend origin
app.use(
  cors({
    origin: "*", // Allow all origins (or specify your frontend domain for security)
  })
);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    const uniqueName = file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// Serve static files from the uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// WebSocket Server
const wss = new WebSocket.Server({ noServer: true });
let connections = [];

// Broadcast to all connected clients
const broadcast = (message) => {
  connections.forEach((ws) => ws.send(JSON.stringify(message)));
};

wss.on("connection", (ws) => {
  connections.push(ws);
  ws.on("close", () => {
    connections = connections.filter((conn) => conn !== ws);
  });
});

// File upload endpoint
app.post("/upload", upload.single("model"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const filePath = req.file.path.replace(/\\/g, "/");
  console.log(`Model uploaded: ${filePath}`);

  const fileUrl = `${req.protocol}://${req.get("host")}/${filePath}`;
  broadcast({ type: "UPLOAD", url: fileUrl });
  res.json({ url: fileUrl });
});

// Delete all files in the uploads directory
app.delete("/uploads/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.filename);
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error("Error deleting file:", err);
      return res.status(500).send("Failed to delete file");
    }
    res.send("File deleted successfully");
  });
});

// List all models endpoint
app.get("/api/models", async (req, res) => {
  const uploadsDir = path.join(__dirname, "uploads");

  try {
    const files = await fs.promises.readdir(uploadsDir);

    const models = files.map((file) => ({
      name: file,
      url: `http://localhost:5000/uploads/${file}`,
    }));

    res.json(models);
  } catch (err) {
    console.error("Error listing models:", err);
    res.status(500).send("Unable to list models");
  }
});

// Upgrade HTTP server for WebSocket
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
