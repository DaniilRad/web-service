import { s3, bucketName } from "../awsConfig";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { filename } = req.query;

  try {
    const params = { Bucket: bucketName, Key: filename };
    await s3.deleteObject(params).promise();

    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("S3 Delete Error:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
}
