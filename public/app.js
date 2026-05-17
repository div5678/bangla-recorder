/* ═══════════════════════════════════════════════
   BANGLA RECORDER — app.js
   ═══════════════════════════════════════════════ */

"use strict";

// ── State ─────────────────────────────────────────────────────
const state = {
  stream: null,
  mediaRecorder: null,
  audioChunks: [],
  videoChunks: [],
  isRecording: false,
  isCameraOn: false,
  startTime: null,
  timerInterval: null,
  recognition: null,
  transcript: "",
  recordedBlob: null,
  audioBlob: null,
  analyser: null,
  animFrame: null,
};

// ── DOM Elements ──────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const preview        = $("preview");
const videoOverlay   = $("videoOverlay");
const recBadge       = $("recBadge");
const timerDisplay   = $("timerDisplay");
const btnCamera      = $("btnCamera");
const btnRecord      = $("btnRecord");
const btnRecordText  = $("btnRecordText");
const btnStop        = $("btnStop");
const btnSave        = $("btnSave");
const btnRefresh     = $("btnRefresh");
const recordingName  = $("recordingName");
const personName     = $("personName");
const recordingDate  = $("recordingDate");
const autoTranscribe = $("autoTranscribe");
const transcriptBox  = $("transcriptBox");
const transcriptText = $("transcriptText");
const interimText    = $("interimText");
const transcriptPlaceholder = $("transcriptPlaceholder");
const statusText     = $("statusText");
const statusDot      = document.querySelector(".status-dot");
const waveform       = $("waveform");
const playbackArea   = $("playbackArea");
const playbackVideo  = $("playbackVideo");
const saveStatus     = $("saveStatus");
const libraryGrid    = $("libraryGrid");
const modalBackdrop  = $("modalBackdrop");
const modalContent   = $("modalContent");

// ── Init ──────────────────────────────────────────────────────
recordingDate.value = new Date().toISOString().split("T")[0];
buildWaveform();
initNavigation();

// ── Navigation ────────────────────────────────────────────────
function initNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      $(`view-${view}`).classList.add("active");
      if (view === "library") loadLibrary();
    });
  });
}

// ── Camera ────────────────────────────────────────────────────
btnCamera.addEventListener("click", toggleCamera);

async function toggleCamera() {
  if (state.isCameraOn) {
    stopCamera();
  } else {
    await startCamera();
  }
}

async function startCamera() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: "user" },
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
    });
    preview.srcObject = state.stream;
    videoOverlay.classList.add("hidden");
    state.isCameraOn = true;
    btnCamera.textContent = "📷 ক্যামেরা বন্ধ";
    btnRecord.disabled = false;
    setupAudioVisualizer();
  } catch (err) {
    showToast("ক্যামেরা অ্যাক্সেস করতে ব্যর্থ হয়েছে: " + err.message, "error");
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
  preview.srcObject = null;
  videoOverlay.classList.remove("hidden");
  state.isCameraOn = false;
  btnCamera.textContent = "📷 ক্যামেরা";
  btnRecord.disabled = true;
  cancelAnimationFrame(state.animFrame);
}

// ── Audio Visualizer ──────────────────────────────────────────
function buildWaveform() {
  waveform.innerHTML = "";
  for (let i = 0; i < 48; i++) {
    const bar = document.createElement("div");
    bar.className = "wave-bar";
    bar.style.height = "3px";
    waveform.appendChild(bar);
  }
}

function setupAudioVisualizer() {
  const audioCtx = new AudioContext();
  state.analyser = audioCtx.createAnalyser();
  state.analyser.fftSize = 128;
  const source = audioCtx.createMediaStreamSource(state.stream);
  source.connect(state.analyser);
  animateWaveform();
}

function animateWaveform() {
  const bars = waveform.querySelectorAll(".wave-bar");
  const data = new Uint8Array(state.analyser.frequencyBinCount);

  function draw() {
    state.animFrame = requestAnimationFrame(draw);
    state.analyser.getByteFrequencyData(data);
    bars.forEach((bar, i) => {
      const val = (data[i] || 0) / 255;
      bar.style.height = `${Math.max(3, val * 48)}px`;
      bar.style.opacity = 0.4 + val * 0.6;
    });
  }
  draw();
}

// ── Recording ────────────────────────────────────────────────
btnRecord.addEventListener("click", startRecording);
btnStop.addEventListener("click", stopRecording);

function startRecording() {
  if (!state.stream || state.isRecording) return;

  state.audioChunks = [];
  state.videoChunks = [];

  // Video recorder
  const videoOptions = { mimeType: getSupportedMimeType() };
  state.mediaRecorder = new MediaRecorder(state.stream, videoOptions);
  state.mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) state.videoChunks.push(e.data);
  };
  state.mediaRecorder.onstop = handleRecordingStop;
  state.mediaRecorder.start(100);

  // Audio-only recorder
  const audioStream = new MediaStream(
    state.stream.getAudioTracks().map((t) => t.clone())
  );
  const audioOptions = { mimeType: "audio/webm;codecs=opus" };
  const audioRec = new MediaRecorder(audioStream, audioOptions);
  audioRec.ondataavailable = (e) => {
    if (e.data.size > 0) state.audioChunks.push(e.data);
  };
  state.audioRecorder = audioRec;
  audioRec.start(100);

  state.isRecording = true;
  state.startTime = Date.now();

  // UI
  recBadge.classList.add("visible");
  btnRecord.classList.add("recording");
  btnRecordText.textContent = "রেকর্ডিং চলছে…";
  btnStop.disabled = false;
  btnCamera.disabled = true;

  // Timer
  timerDisplay.textContent = "00:00";
  state.timerInterval = setInterval(updateTimer, 500);

  // Speech recognition
  if (autoTranscribe.checked) startSpeechRecognition();
}

function stopRecording() {
  if (!state.isRecording) return;
  state.isRecording = false;
  state.mediaRecorder?.stop();
  state.audioRecorder?.stop();
  stopSpeechRecognition();
  clearInterval(state.timerInterval);

  recBadge.classList.remove("visible");
  btnRecord.classList.remove("recording");
  btnRecordText.textContent = "রেকর্ড শুরু";
  btnStop.disabled = true;
  btnCamera.disabled = false;
}

function handleRecordingStop() {
  const mimeType = getSupportedMimeType();
  state.recordedBlob = new Blob(state.videoChunks, { type: mimeType });
  state.audioBlob    = new Blob(state.audioChunks, { type: "audio/webm;codecs=opus" });

  const url = URL.createObjectURL(state.recordedBlob);
  playbackVideo.src = url;
  playbackArea.style.display = "flex";

  btnSave.disabled = false;
  showToast("রেকর্ডিং সম্পন্ন হয়েছে! এখন সংরক্ষণ করুন।", "success");
}

function getSupportedMimeType() {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";
}

function updateTimer() {
  const elapsed = Date.now() - state.startTime;
  const mins = Math.floor(elapsed / 60000).toString().padStart(2, "0");
  const secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, "0");
  timerDisplay.textContent = `${mins}:${secs}`;
}

// ── Speech Recognition ────────────────────────────────────────
function startSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setStatus("ব্রাউজার সমর্থন করে না", "error");
    showToast("আপনার ব্রাউজার বাংলা স্পিচ রিকগনিশন সমর্থন করে না।", "error");
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.lang = "bn-BD";
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.maxAlternatives = 1;

  state.recognition.onstart = () => setStatus("শুনছে…", "listening");

  state.recognition.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      if (result.isFinal) {
        state.transcript += result[0].transcript + " ";
        transcriptText.textContent = state.transcript;
      } else {
        interim += result[0].transcript;
      }
    }
    interimText.textContent = interim;
    transcriptPlaceholder.style.display = state.transcript ? "none" : "block";
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
  };

  state.recognition.onerror = (e) => {
    if (e.error === "no-speech") return;
    setStatus("ত্রুটি: " + e.error, "error");
  };

  state.recognition.onend = () => {
    // Restart if still recording
    if (state.isRecording) {
      try { state.recognition.start(); } catch (_) {}
    } else {
      setStatus("সম্পন্ন", "idle");
    }
  };

  try {
    state.recognition.start();
  } catch (err) {
    setStatus("শুরু করতে ব্যর্থ", "error");
  }
}

function stopSpeechRecognition() {
  if (state.recognition) {
    state.recognition.onend = null;
    state.recognition.stop();
    state.recognition = null;
  }
  interimText.textContent = "";
  setStatus("সম্পন্ন", "idle");
}

function setStatus(text, type) {
  statusText.textContent = text;
  statusDot.className = "status-dot " + type;
}

// ── Transcript Buttons ────────────────────────────────────────
$("btnClearTranscript").addEventListener("click", () => {
  state.transcript = "";
  transcriptText.textContent = "";
  interimText.textContent = "";
  transcriptPlaceholder.style.display = "block";
});

$("btnCopyTranscript").addEventListener("click", () => {
  if (state.transcript) {
    navigator.clipboard.writeText(state.transcript).then(() =>
      showToast("ট্রান্সক্রিপ্ট কপি করা হয়েছে!", "success")
    );
  }
});

// ── Save ──────────────────────────────────────────────────────
btnSave.addEventListener("click", saveRecording);

async function saveRecording() {
  if (!state.recordedBlob) return;

  const name = recordingName.value.trim() || "অজানা রেকর্ডিং";
  const person = personName.value.trim();
  const date = recordingDate.value;
  const duration = timerDisplay.textContent;

  btnSave.disabled = true;
  saveStatus.style.color = "var(--gold)";
  saveStatus.textContent = "⏳ সার্ভারে পাঠানো হচ্ছে…";

  const formData = new FormData();
  formData.append("recordingName", name);
  formData.append("personName", person);
  formData.append("recordingDate", date);
  formData.append("transcript", state.transcript);
  formData.append("duration", duration);
  formData.append("video", state.recordedBlob, "recording.webm");
  formData.append("audio", state.audioBlob, "audio.webm");

  try {
    const res = await fetch("/api/recordings", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (data.success) {
      saveStatus.style.color = "var(--green)";
      saveStatus.textContent = "✅ সফলভাবে সংরক্ষিত হয়েছে!";
      showToast(`"${name}" সার্ভারে সংরক্ষিত হয়েছে।`, "success");
      // Reset
      setTimeout(() => {
        state.recordedBlob = null;
        state.audioBlob = null;
        state.transcript = "";
        transcriptText.textContent = "";
        transcriptPlaceholder.style.display = "block";
        playbackArea.style.display = "none";
        playbackVideo.src = "";
        recordingName.value = "";
        personName.value = "";
        recordingDate.value = new Date().toISOString().split("T")[0];
        timerDisplay.textContent = "00:00";
        saveStatus.textContent = "";
        btnSave.disabled = true;
      }, 3000);
    } else {
      throw new Error(data.error || "Unknown error");
    }
  } catch (err) {
    saveStatus.style.color = "var(--red)";
    saveStatus.textContent = "❌ সংরক্ষণ ব্যর্থ: " + err.message;
    btnSave.disabled = false;
  }
}

// ── Library ───────────────────────────────────────────────────
btnRefresh.addEventListener("click", loadLibrary);

async function loadLibrary() {
  libraryGrid.innerHTML = '<div class="loading-state">লোড হচ্ছে…</div>';
  try {
    const res = await fetch("/api/recordings");
    const data = await res.json();
    renderLibrary(data.recordings || []);
  } catch {
    libraryGrid.innerHTML = '<div class="loading-state">লোড করতে ব্যর্থ হয়েছে।</div>';
  }
}

function renderLibrary(recordings) {
  if (!recordings.length) {
    libraryGrid.innerHTML =
      '<div class="loading-state">কোনো রেকর্ডিং পাওয়া যায়নি।</div>';
    return;
  }

  libraryGrid.innerHTML = recordings
    .map((rec) => {
      const excerpt = rec.transcript
        ? rec.transcript.slice(0, 180) + (rec.transcript.length > 180 ? "…" : "")
        : "(কোনো ট্রান্সক্রিপ্ট নেই)";

      return `
        <div class="rec-card" onclick="openRecording('${rec.id}')">
          <div class="rec-card-header">
            <div class="rec-card-title">${esc(rec.recordingName)}</div>
            <div class="rec-card-date">${rec.recordingDate || "—"}</div>
          </div>
          <div class="rec-card-meta">
            ${rec.personName ? `<div class="rec-meta-item">👤 ${esc(rec.personName)}</div>` : ""}
            <div class="rec-meta-item">⏱ ${rec.duration || "—"}</div>
            ${rec.videoFile ? '<span class="chip has-video">📹 ভিডিও</span>' : ""}
            ${rec.audioFile ? '<span class="chip has-audio">🎵 অডিও</span>' : ""}
          </div>
          ${rec.transcript ? `<div class="rec-card-excerpt">${esc(excerpt)}</div>` : ""}
          <div class="rec-card-actions">
            <button class="btn-ghost" onclick="event.stopPropagation(); deleteRecording('${rec.id}')">🗑 মুছুন</button>
          </div>
        </div>`;
    })
    .join("");
}

// ── Open Recording Modal ──────────────────────────────────────
async function openRecording(id) {
  modalBackdrop.classList.add("open");
  modalContent.innerHTML = '<p style="color:var(--text-dim)">লোড হচ্ছে…</p>';

  try {
    const res = await fetch(`/api/recordings/${id}`);
    const data = await res.json();
    const rec = data.recording;

    modalContent.innerHTML = `
      <h2 class="modal-title">${esc(rec.recordingName)}</h2>
      <div class="modal-meta">
        ${rec.personName ? `<span>👤 ${esc(rec.personName)}</span>` : ""}
        <span>📅 ${rec.recordingDate || "—"}</span>
        <span>⏱ ${rec.duration || "—"}</span>
        <span>🗓 সংরক্ষিত: ${new Date(rec.createdAt).toLocaleString("bn-BD")}</span>
      </div>

      ${rec.videoFile
        ? `<video class="modal-video" controls src="/uploads/video/${rec.videoFile}"></video>`
        : ""}

      ${rec.audioFile && !rec.videoFile
        ? `<audio class="modal-audio" controls src="/uploads/audio/${rec.audioFile}"></audio>`
        : ""}

      ${rec.transcript
        ? `<h3 class="section-title" style="margin-bottom:10px">বাংলা ট্রান্সক্রিপ্ট</h3>
           <div class="modal-transcript">${esc(rec.transcript)}</div>`
        : ""}

      <div class="modal-actions">
        ${rec.videoFile
          ? `<a class="btn btn-secondary" href="/uploads/video/${rec.videoFile}" download="recording.webm">⬇ ভিডিও ডাউনলোড</a>`
          : ""}
        ${rec.audioFile
          ? `<a class="btn btn-secondary" href="/uploads/audio/${rec.audioFile}" download="audio.webm">⬇ অডিও ডাউনলোড</a>`
          : ""}
        ${rec.transcript
          ? `<button class="btn btn-secondary" onclick="downloadTranscript('${esc(rec.transcript)}','${esc(rec.recordingName)}')">⬇ ট্রান্সক্রিপ্ট ডাউনলোড</button>`
          : ""}
        <button class="btn btn-secondary" style="margin-left:auto; color:var(--red)" onclick="deleteRecording('${rec.id}', true)">🗑 মুছুন</button>
      </div>`;
  } catch {
    modalContent.innerHTML = '<p style="color:var(--red)">লোড করতে ব্যর্থ।</p>';
  }
}

$("modalClose").addEventListener("click", () => modalBackdrop.classList.remove("open"));
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) modalBackdrop.classList.remove("open");
});

// ── Delete ────────────────────────────────────────────────────
async function deleteRecording(id, fromModal = false) {
  if (!confirm("এই রেকর্ডিং মুছতে চান?")) return;
  try {
    const res = await fetch(`/api/recordings/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      if (fromModal) modalBackdrop.classList.remove("open");
      loadLibrary();
      showToast("রেকর্ডিং মুছে দেওয়া হয়েছে।", "success");
    }
  } catch {
    showToast("মুছতে ব্যর্থ হয়েছে।", "error");
  }
}

// ── Download Transcript ───────────────────────────────────────
function downloadTranscript(text, name) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${name}_transcript.txt`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = "info") {
  const toast = document.createElement("div");
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: "fixed", bottom: "24px", right: "24px", zIndex: "999",
    background: type === "error" ? "var(--red)" : type === "success" ? "#2a5a3a" : "var(--surface-3)",
    color: "var(--cream)", padding: "12px 20px", borderRadius: "10px",
    boxShadow: "var(--shadow)", fontSize: "14px", fontFamily: "'Hind Siliguri', sans-serif",
    border: "1px solid var(--border)", maxWidth: "360px", lineHeight: "1.5",
    animation: "slideUp 0.3s ease",
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ── Helpers ───────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Expose to global for inline handlers
window.openRecording = openRecording;
window.deleteRecording = deleteRecording;
window.downloadTranscript = downloadTranscript;
