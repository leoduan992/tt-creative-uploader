// pages/index.js
import { useState } from "react";
import axios from "axios";
import SparkMD5 from "spark-md5";

// 推荐 5~10MB：平衡请求次数与超时风险
const CHUNK_SIZE = 8 * 1024 * 1024;

export default function Home() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [successList, setSuccessList] = useState([]);
  const [failList, setFailList] = useState([]);
  const [fixOn, setFixOn] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 浏览器增量计算整文件 MD5（TikTok 要的 signature）
  async function md5OfFileIncremental(file) {
    return new Promise((resolve, reject) => {
      const blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;
      const chunks = Math.ceil(file.size / CHUNK_SIZE);
      let currentChunk = 0;
      const spark = new SparkMD5.ArrayBuffer();
      const fileReader = new FileReader();

      fileReader.onload = e => {
        spark.append(e.target.result);
        currentChunk++;
        if (currentChunk < chunks) {
          loadNext();
        } else {
          resolve(spark.end()); // hex md5
        }
      };
      fileReader.onerror = () => reject(new Error("FileReader error while hashing"));

      function loadNext() {
        const start = currentChunk * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
      }
      loadNext();
    });
  }

  async function startUpload() {
    if (!file) return alert("先选择文件");
    setUploading(true);
    setProgress(0);
    setStatus("计算 MD5…（仅首次耗时）");

    try {
      const signature = await md5OfFileIncremental(file);

      setStatus("申请 upload_id…");
      const startRes = await axios.post("/api/tiktok-chunk/start", {
        size: file.size,
        name: file.name,
        content_type: "video",
      });
      if (startRes.data?.code !== 0) throw new Error("start 失败：" + JSON.stringify(startRes.data));
      const upload_id = startRes.data?.data?.upload_id;
      if (!upload_id) throw new Error("未返回 upload_id");

      // 分片循环
      let sent = 0;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const fd = new FormData();
        fd.append("upload_id", upload_id);
        fd.append("start_offset", String(sent));
        fd.append("signature", signature); // 整文件 MD5
        fd.append("chunk", chunk, `${file.name}.part${i}`);

        setStatus(`上传分片 ${i + 1}/${totalChunks}…`);
        await axios.post("/api/tiktok-chunk/transfer", fd, {
          timeout: 20000,
          onUploadProgress: (e) => {
            if (e.total) {
              const base = (i / totalChunks) * 100;
              const piece = (e.loaded / e.total) * (100 / totalChunks);
              setProgress(Math.min(100, Math.round(base + piece)));
            }
          },
        });

        sent += chunk.size;
      }

      setStatus("完成分片（finish）…");
      const fin = await axios.post("/api/tiktok-chunk/finish", { upload_id });
      if (fin.data?.code !== 0) throw new Error("finish 失败：" + JSON.stringify(fin.data));
      const file_id = fin.data?.data?.file_id;
      if (!file_id) throw new Error("未返回 file_id");

      setStatus("绑定为视频（UPLOAD_BY_FILE_ID）…");
      const bind = await axios.post("/api/tiktok-chunk/bind", {
        file_id,
        file_name: fileName || file.name,
        flaw_detect: fixOn,
        auto_fix_enabled: fixOn,
        auto_bind_enabled: fixOn,
      });
      if (bind.data?.code !== 0) throw new Error("bind 失败：" + JSON.stringify(bind.data));

      setProgress(100);
      setStatus("上传成功 ✅");
      const videoId = bind.data?.data?.[0]?.video_id || "待查";
      setSuccessList((s) => [...s, `${file.name} -> video_id: ${videoId}`]);
    } catch (e) {
      console.error(e);
      setStatus(`失败：${e.message}`);
      setFailList((s) => [...s, file?.name || "unknown"]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", fontFamily: "system-ui, Arial" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>🎬 TT Creative Uploader（官方分片直传 v1.3）</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>Start → Transfer ×N → Finish → Bind（生成 video_id 用于投放）</p>

      <input
        type="text"
        placeholder="素材名称（可选，避免重名）"
        value={fileName}
        onChange={(e) => setFileName(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 8 }}
      />

      <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} disabled={uploading} />

      <div style={{ marginTop: 10 }}>
        <label>
          <input type="checkbox" checked={fixOn} onChange={(e) => setFixOn(e.target.checked)} /> 启用智能修复（flaw_detect + auto_fix_enabled + auto_bind_enabled）
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={startUpload} disabled={!file || uploading} style={{ padding: "10px 18px" }}>
          {uploading ? "上传中…" : "开始上传"}
        </button>
      </div>

      <div style={{ height: 10, background: "#eee", borderRadius: 6, marginTop: 16, overflow: "hidden" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "#4f46e5", transition: "width 200ms" }} />
      </div>
      <p style={{ marginTop: 8 }}>{status}</p>

      <div style={{ marginTop: 24 }}>
        <h3>✅ 成功：</h3>
        <ul>{successList.map((n, i) => <li key={i}>{n}</li>)}</ul>
        <h3>❌ 失败：</h3>
        <ul>{failList.map((n, i) => <li key={i}>{n}</li>)}</ul>
      </div>
    </div>
  );
}
