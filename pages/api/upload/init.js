// pages/api/upload/init.js
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const config = {
  api: { bodyParser: true, sizeLimit: "1mb" },
  runtime: "nodejs",
};

const ROOT = path.join(process.cwd(), ".upload_tmp");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { filename, size, chunkSize } = req.body || {};
  if (!filename || !size || !chunkSize) {
    return res.status(400).json({ error: "missing params: filename/size/chunkSize" });
  }

  // 生成 uploadId（你也可以用 filename+size 做 hash）
  const uploadId = crypto.randomUUID();

  const dir = path.join(ROOT, uploadId);
  const chunkDir = path.join(dir, "chunks");
  fs.mkdirSync(chunkDir, { recursive: true });

  const totalChunks = Math.ceil(Number(size) / Number(chunkSize));
  const manifest = {
    uploadId,
    filename,
    size: Number(size),
    chunkSize: Number(chunkSize),
    totalChunks,
    received: [],       // 已收到的分片 index 列表
    createdAt: Date.now(),
  };
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  return res.status(200).json({ uploadId, totalChunks });
}
