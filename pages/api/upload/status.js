// pages/api/upload/status.js
import fs from "fs";
import path from "path";

export const config = { api: { bodyParser: true }, runtime: "nodejs" };

const ROOT = path.join(process.cwd(), ".upload_tmp");

export default async function handler(req, res) {
  const { uploadId } = (req.method === "GET" ? req.query : req.body) || {};
  if (!uploadId) return res.status(400).json({ error: "missing uploadId" });

  const dir = path.join(ROOT, uploadId);
  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return res.status(404).json({ error: "not_found" });

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return res.status(200).json({
    uploadId,
    received: manifest.received.sort((a, b) => a - b),
    totalChunks: manifest.totalChunks,
    filename: manifest.filename,
    size: manifest.size,
  });
}
