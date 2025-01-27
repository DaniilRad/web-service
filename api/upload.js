// import formidable from "formidable";
// import fs from "fs";
// import { s3, bucketName } from "../awsConfig";

// export default async function handler(req, res) {
//   if (req.method !== "POST") {
//     return res.status(405).json({ error: "Method not allowed" });
//   }

//   const form = formidable({ multiples: false });

//   form.parse(req, async (err, fields, files) => {
//     if (err) {
//       console.error("Formidable error:", err);
//       return res.status(500).json({ error: "File upload failed" });
//     }

//     const file = files.model;
//     const fileStream = fs.createReadStream(file.filepath);

//     const params = {
//       Bucket: bucketName,
//       Key: file.originalFilename,
//       Body: fileStream,
//       ContentType: file.mimetype,
//     };

//     try {
//       const uploadResult = await s3.upload(params).promise();
//       res.status(200).json({ url: uploadResult.Location });
//     } catch (uploadError) {
//       console.error("S3 Upload Error:", uploadError);
//       res.status(500).json({ error: "Failed to upload to S3" });
//     }
//   });
// }

// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };


const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const path = require('path');
require('dotenv').config();

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

router.post('/', upload.single('model'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: 'No file uploaded!' });
        }

        const fileContent = req.file.buffer;
        const fileName = `${Date.now()}-${path.basename(req.file.originalname)}`;

        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            Body: fileContent,
            ContentType: req.file.mimetype,
        };

        const data = await s3.upload(params).promise();
        res.status(200).send({ message: 'File uploaded successfully!', data });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Upload failed!', error });
    }
});

module.exports = router;
