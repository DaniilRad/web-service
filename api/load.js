import { s3, bucketName } from "../awsConfig";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
}
