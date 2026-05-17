const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));
app.use(express.static(path.join(__dirname, "../public")));

// ── Upload directories ──────────────────────────────────────
const UPLOAD_BASE = path.join(__dirname, "../uploads");
["audio", "video", "transcripts"].forEach((dir) =>
  fs.ensureDirSync(path.join(UPLOAD_BASE, dir))
);

// ── Recordings metadata store (JSON file-based) ─────────────
const META_FILE = path.join(UPLOAD_BASE, "recordings.json");
if (!fs.existsSync(META_FILE)) fs.writeJsonSync(META_FILE, []);

function readMeta() {
  return fs.readJsonSync(META_FILE);
}
function writeMeta(data) {
  fs.writeJsonSync(META_FILE, data, { spaces: 2 });
}

// ── Multer storage ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = file.fieldname === "video" ? "video" : "audio";
    cb(null, path.join(UPLOAD_BASE, type));
  },
  filename: (req, file, cb) => {
    const ext = file.mimetype.includes("video") ? ".webm" : ".webm";
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

// ── Routes ──────────────────────────────────────────────────

// Save a recording (audio + video + metadata)
app.post(
  "/api/recordings",
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const {
        recordingName,
        personName,
        recordingDate,
        transcript,
        duration,
      } = req.body;

      const id = uuidv4();
      const createdAt = new Date().toISOString();

      // Save transcript to file
      const transcriptFilename = `${id}.txt`;
      fs.writeFileSync(
        path.join(UPLOAD_BASE, "transcripts", transcriptFilename),
        transcript || ""
      );

      const entry = {
        id,
        recordingName: recordingName || "Unnamed Recording",
        personName: personName || "",
        recordingDate: recordingDate || createdAt.split("T")[0],
        duration: duration || "0",
        transcript: transcript || "",
        transcriptFile: transcriptFilename,
        audioFile: req.files?.audio?.[0]?.filename || null,
        videoFile: req.files?.video?.[0]?.filename || null,
        createdAt,
      };

      const recordings = readMeta();
      recordings.unshift(entry);
      writeMeta(recordings);

      res.json({ success: true, recording: entry });
    } catch (err) {
      console.error("Save error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// List all recordings
app.get("/api/recordings", (req, res) => {
  try {
    const recordings = readMeta();
    res.json({ success: true, recordings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get a single recording
app.get("/api/recordings/:id", (req, res) => {
  try {
    const recordings = readMeta();
    const rec = recordings.find((r) => r.id === req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    res.json({ success: true, recording: rec });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a recording
app.delete("/api/recordings/:id", (req, res) => {
  try {
    const recordings = readMeta();
    const idx = recordings.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const rec = recordings[idx];
    // Delete files
    if (rec.audioFile)
      fs.removeSync(path.join(UPLOAD_BASE, "audio", rec.audioFile));
    if (rec.videoFile)
      fs.removeSync(path.join(UPLOAD_BASE, "video", rec.videoFile));
    if (rec.transcriptFile)
      fs.removeSync(path.join(UPLOAD_BASE, "transcripts", rec.transcriptFile));

    recordings.splice(idx, 1);
    writeMeta(recordings);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve uploaded files
app.use("/uploads", express.static(UPLOAD_BASE));

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎙️  Bangla Recorder Server running at http://localhost:${PORT}`);
  console.log(`📂  Uploads stored in: ${UPLOAD_BASE}\n`);
});
