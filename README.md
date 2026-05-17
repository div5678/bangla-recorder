# 🎙️ বাংলা রেকর্ডার — Bangla Voice Studio

A full-stack web application for recording audio/video with real-time Bangla (Bengali) speech-to-text transcription.

---

## ✨ Features

| Feature | Details |
|---|---|
| 📹 Video Recording | Full HD webcam recording using MediaRecorder API |
| 🎤 Audio Recording | Separate audio-only track saved alongside video |
| 🗣 Bangla STT | Real-time speech-to-text in Bengali (bn-BD) via Web Speech API |
| 📝 Metadata | Recording name, person's name, date of recording |
| 💾 Server Storage | Audio + video + transcript saved on server via Express REST API |
| 📚 Library | Browse, play back, download, and delete saved recordings |
| ⬇ Downloads | Download video, audio, or transcript from any saved recording |

---

## 🏗 Project Structure

```
bangla-recorder/
├── server/
│   └── index.js          # Express API server
├── public/
│   ├── index.html        # Main UI
│   ├── style.css         # Styles (dark warm terracotta theme)
│   └── app.js            # Client-side logic
├── uploads/
│   ├── audio/            # Saved audio files (.webm)
│   ├── video/            # Saved video files (.webm)
│   ├── transcripts/      # Saved transcripts (.txt)
│   └── recordings.json   # Metadata store
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v16+ 
- A modern browser (Chrome or Edge recommended for best Bangla STT support)

### Installation

```bash
# 1. Clone or extract the project
cd bangla-recorder

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# For development with auto-reload:
npm run dev
```

### Access the App

Open your browser and go to: **http://localhost:3000**

---

## 📖 How to Use

### Recording
1. Click **📷 ক্যামেরা** to activate your webcam and microphone
2. Fill in the recording details (name, person, date)
3. Click **⏺ রেকর্ড শুরু** to begin recording
4. Speak in Bangla — transcript appears in real time
5. Click **⏹ থামান** to stop recording
6. Preview your recording, then click **💾 সার্ভারে সংরক্ষণ করুন**

### Library
1. Navigate to **লাইব্রেরি** (Library) tab
2. Click any card to open the full recording modal
3. Play back video/audio, read the transcript
4. Download or delete recordings as needed

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/recordings` | Save a new recording (multipart/form-data) |
| `GET` | `/api/recordings` | List all recordings |
| `GET` | `/api/recordings/:id` | Get one recording by ID |
| `DELETE` | `/api/recordings/:id` | Delete a recording and its files |
| `GET` | `/uploads/video/:file` | Serve a video file |
| `GET` | `/uploads/audio/:file` | Serve an audio file |

### POST `/api/recordings` — Fields

| Field | Type | Description |
|---|---|---|
| `recordingName` | string | Name of the recording |
| `personName` | string | Name of the person recorded |
| `recordingDate` | string | Date (YYYY-MM-DD) |
| `transcript` | string | Bangla transcript text |
| `duration` | string | Duration (MM:SS) |
| `video` | file | Video blob (.webm) |
| `audio` | file | Audio blob (.webm) |

---

## 🔧 Configuration

Edit `server/index.js` to change:
- **Port**: `const PORT = process.env.PORT || 3000;`
- **Upload size limit**: `limits: { fileSize: 500 * 1024 * 1024 }` (currently 500MB)
- **Upload directory**: `const UPLOAD_BASE = ...`

---

## 🌍 Browser Support for Bangla STT

The Web Speech API with Bengali (bn-BD) support works best in:
- ✅ **Google Chrome** (recommended)
- ✅ **Microsoft Edge**
- ⚠️ Firefox — limited or no support
- ⚠️ Safari — limited support

For production use with broader support, consider integrating:
- **Google Cloud Speech-to-Text API**
- **Azure Cognitive Services Speech**
- **OpenAI Whisper** (with Bengali fine-tuning)

---

## 🔒 Production Notes

For production deployment:
- Replace the JSON file store with a proper database (PostgreSQL, MongoDB)
- Add authentication (JWT / session-based)
- Use cloud storage (AWS S3, Google Cloud Storage) instead of local filesystem
- Add HTTPS (via reverse proxy like Nginx + Let's Encrypt)
- Set `CORS` origins explicitly
- Add rate limiting with `express-rate-limit`

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `express` | HTTP server |
| `multer` | File upload handling |
| `cors` | Cross-origin resource sharing |
| `uuid` | Unique IDs for recordings |
| `fs-extra` | Enhanced file system operations |
| `nodemon` | Dev auto-reload |
