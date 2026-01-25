"use strict";

/* ==================== STATE ==================== */
let draggedIndex = null;

const canvas = document.getElementById("playerCanvas");
const ctx = canvas.getContext("2d");

const video = document.getElementById("videoHidden");
const effectSelect = document.getElementById("effectSelect");

const playlistEl = document.getElementById("playlist");
const fileInput = document.getElementById("fileInput");
const subsInput = document.getElementById("subsInput");
const dropZone = document.getElementById("dropZone");

// Video separat pentru preview
const previewVideo = document.createElement("video");
previewVideo.muted = true;
previewVideo.preload = "metadata";
previewVideo.crossOrigin = "anonymous";

// helper: extrage numele fișierului fără extensie dintr-o cale
function fileNameFromPath(path) {
  const file = String(path).split("/").pop();
  return file.replace(/\.[^/.]+$/, "");
}

// PLAYLIST INIȚIAL
let playlist = [
  { src: "media/film1.mp4", subs: "media/film1.json" },
  { src: "media/film2.mp4", subs: null },
  { src: "media/film3.mp4", subs: null },
  { src: "media/film4.mp4", subs: null },
].map((item) => ({
  title: fileNameFromPath(item.src),
  src: item.src,
  subs: item.subs,
}));

let currentIndex = 0;
let currentEffect = "none";
let rafId = null;

// zone interactive pe canvas
const ui = {
  prevRect: null,
  playRect: null,
  nextRect: null,
  progressRect: null,
  volumeRect: null,
};

// preview pe progress bar
let hoveringProgress = false;
let hoverX = 0;
let previewTime = null;
let lastPreviewTimeDrawn = null;

// subtitrări
let subtitles = [];

// Web Storage keys
const STORAGE_VOLUME_KEY = "player_volume";//volumul setat
const STORAGE_INDEX_KEY = "player_index";//video-ul curent

/* ==================== HELPERS ==================== */

//verifică dacă un punct (x, y) este in interiorul unui control.
function pointInRect(x, y, rect) {
  if (!rect) return false;
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function formatTime(sec) {
  sec = sec || 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

//corectează poziția mouse-ului pe canvas
//Mouse-ul dă coordonate în pixeli de ecran (CSS), 
//dar canvas-ul desenează în pixeli interni (canvas width/height).
function getCanvasPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY,
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(v, max));//limitează o valoare
}

/* ==================== PLAYLIST UI ==================== */

function renderPlaylist() {
  playlistEl.innerHTML = "";

  playlist.forEach((item, index) => {
    const li = document.createElement("li");
    if (index === currentIndex) li.classList.add("active");

    li.draggable = true;
    li.dataset.index = String(index);

    const titleSpan = document.createElement("span");
    titleSpan.className = "title";
    titleSpan.textContent = item.title;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "del";
    delBtn.textContent = "✕";
    delBtn.title = "Șterge";

    li.appendChild(titleSpan);
    li.appendChild(delBtn);

    li.addEventListener("click", (e) => {
     
      if (e.target === delBtn) return;
      loadVideo(index, true);
    });

    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteItem(index);
    });

    // DRAG & DROP reorder
    li.addEventListener("dragstart", (e) => {
      draggedIndex = index;
      e.dataTransfer.effectAllowed = "move";
    });

    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    li.addEventListener("drop", (e) => {
      e.preventDefault();
      const targetIndex = Number(li.dataset.index);
      if (draggedIndex === null || draggedIndex === targetIndex) return;

      const [moved] = playlist.splice(draggedIndex, 1);
      playlist.splice(targetIndex, 0, moved);

      // actualizez currentIndex
      //păstrează “video-ul curent” corect după reorder
      if (currentIndex === draggedIndex) currentIndex = targetIndex;
      else if (draggedIndex < currentIndex && targetIndex >= currentIndex) currentIndex--;
      else if (draggedIndex > currentIndex && targetIndex <= currentIndex) currentIndex++;

      draggedIndex = null;
      renderPlaylist();
      saveSettings();
    });

    playlistEl.appendChild(li);
  });
}

function deleteItem(index) {
  if (playlist.length <= 1) return;

  const wasCurrent = index === currentIndex;
  playlist.splice(index, 1);

  if (currentIndex >= playlist.length) currentIndex = playlist.length - 1;
  if (index < currentIndex) currentIndex--;

  renderPlaylist();

  if (wasCurrent) loadVideo(currentIndex, true);
  saveSettings();
}

/* ========== ADĂUGARE VIDEO (input + drag&drop) ========== */

fileInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  addFilesToPlaylist(files);
  fileInput.value = "";
});

function addFilesToPlaylist(files) {
  const wasEmpty = playlist.length === 0;

  files.forEach((file) => {
    if (!file.type.startsWith("video/")) return;

    const url = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, "");

    playlist.push({
      title: cleanName,
      src: url,
      subs: null,
    });
  });

  if (playlist.length === 0) return;

  renderPlaylist();
  saveSettings();

  if (wasEmpty) {
    currentIndex = 0;
    loadVideo(0, true);
  }
}

/* ==================== SUBTITRĂRI ==================== */

subsInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".json")) {
    alert("Trebuie fișier .json!");
    return;
  }

  const url = URL.createObjectURL(file);
  playlist[currentIndex].subs = url;

  saveSettings();
  loadSubtitles(url);

  subsInput.value = "";
});

function loadSubtitles(url) {
  subtitles = [];
  if (!url) return;

  fetch(url)
    .then((r) => r.json())
    .then((data) => (subtitles = Array.isArray(data) ? data : []))
    .catch(() => (subtitles = []));
}

function getCurrentSubtitle(t) {
  if (!subtitles.length) return null;
  return subtitles.find((s) => t >= s.start && t <= s.end) || null;
}

/* ==================== DROP ZONE (video + json cu același nume) ==================== */

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("hover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("hover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("hover");

  const files = Array.from(e.dataTransfer.files || []);
  if (!files.length) return;

  // grupăm fișierele după numele fără extensie
  const groups = {}; // { filmX: { video: File|null, subs: File|null } }

  files.forEach((f) => {
    const baseName = f.name.replace(/\.[^/.]+$/, "");
    if (!groups[baseName]) groups[baseName] = { video: null, subs: null };

    if (f.type.startsWith("video/")) groups[baseName].video = f;
    else if (f.name.toLowerCase().endsWith(".json")) groups[baseName].subs = f;
  });

  Object.keys(groups).forEach((name) => {
    const g = groups[name];
    if (!g.video) return;

    const videoURL = URL.createObjectURL(g.video);//“link local temporar” către fișier
    const subsURL = g.subs ? URL.createObjectURL(g.subs) : null;

    playlist.push({
      title: name,
      src: videoURL,
      subs: subsURL,
    });
  });

  renderPlaylist();
  saveSettings();
});

/* ==================== ÎNCĂRCARE VIDEO ==================== */

function loadVideo(index, autoPlay = true) {
  if (index < 0 || index >= playlist.length) return;

  currentIndex = index;
  const item = playlist[currentIndex];

  video.src = item.src;
  video.load();

  previewVideo.src = item.src;
  previewVideo.load();//un al doilea <video> doar pentru preview.

  loadSubtitles(item.subs);
  renderPlaylist();
  saveSettings();

  video.addEventListener(
    "loadedmetadata",
    function onMeta() {
      canvas.width = video.videoWidth || 960;
      canvas.height = video.videoHeight || 540;
      video.removeEventListener("loadedmetadata", onMeta);
    },
    { once: true }
  );

  if (autoPlay) video.play().catch(() => {});
}

// când se termină un film → trece automat la următorul
video.addEventListener("ended", () => {
  if (currentIndex < playlist.length - 1) loadVideo(currentIndex + 1, true);
});

/* ==================== EFECTE VIDEO (canvas) ==================== */

function applyEffect(imageData) {
  const data = imageData.data;

  switch (currentEffect) {
    case "mirror": {
      const { width, height } = imageData;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width / 2; x++) {
          const li = (y * width + x) * 4;
          const ri = (y * width + (width - 1 - x)) * 4;
          for (let k = 0; k < 4; k++) {
            const tmp = data[li + k];
            data[li + k] = data[ri + k];
            data[ri + k] = tmp;
          }
        }
      }
      break;
    }
    case "bright": {
      const delta = 40;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] + delta);
        data[i + 1] = Math.min(255, data[i + 1] + delta);
        data[i + 2] = Math.min(255, data[i + 2] + delta);
      }
      break;
    }
    case "posterize": {
      const levels = 4;
      const step = 255 / (levels - 1);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round(data[i] / step) * step;
        data[i + 1] = Math.round(data[i + 1] / step) * step;
        data[i + 2] = Math.round(data[i + 2] / step) * step;
      }
      break;
    }
    default:
      break;
  }

  return imageData;
}

effectSelect.addEventListener("change", () => {
  currentEffect = effectSelect.value;
});

/* ==================== INPUT: CLICK + HOVER (FIX SEEK) ==================== */

canvas.addEventListener("click", (e) => {
  const { x, y } = getCanvasPos(e);

  // 1) SEEK pe progress (o singură dată)
  if (pointInRect(x, y, ui.progressRect) && video.duration) {
    const rel = (x - ui.progressRect.x) / ui.progressRect.w;
    video.currentTime = clamp(video.duration * rel, 0, video.duration);

    
    if (video.paused) video.play().catch(() => {});
    return;
  }

  // 2) PLAY/PAUSE
  if (pointInRect(x, y, ui.playRect)) {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    return;
  }

  // 3) PREV / NEXT
  if (pointInRect(x, y, ui.prevRect)) {
    if (currentIndex > 0) loadVideo(currentIndex - 1, true);
    return;
  }

  if (pointInRect(x, y, ui.nextRect)) {
    if (currentIndex < playlist.length - 1) loadVideo(currentIndex + 1, true);
    return;
  }

  // 4) VOLUME
  if (pointInRect(x, y, ui.volumeRect)) {
    const rel = (x - ui.volumeRect.x) / ui.volumeRect.w;
    video.volume = clamp(rel, 0, 1);
    saveSettings();
    return;
  }
});

canvas.addEventListener("mousemove", (e) => {
  const { x, y } = getCanvasPos(e);

  hoverX = x;

  if (pointInRect(x, y, ui.progressRect) && video.duration) {
    hoveringProgress = true;
    const rel = (x - ui.progressRect.x) / ui.progressRect.w;
    previewTime = clamp(video.duration * rel, 0, video.duration);

    if (!Number.isNaN(previewTime)) {
      
      previewVideo.currentTime = previewTime;
    }
  } else {
    hoveringProgress = false;
    previewTime = null;
    lastPreviewTimeDrawn = null;
  }
});

canvas.addEventListener("mouseleave", () => {
  hoveringProgress = false;
  previewTime = null;
  lastPreviewTimeDrawn = null;
});

/* ============== DESENARE CONTROALE & PREVIEW ============== */

// icon: triunghi spre stânga 
function drawSkipPrevIcon(rect, centerY) {
  ctx.beginPath();

  // triunghi spre stânga
  ctx.moveTo(rect.x + rect.w - 6, centerY - 11);
  ctx.lineTo(rect.x + 10, centerY);
  ctx.lineTo(rect.x + rect.w - 6, centerY + 11);
  ctx.closePath();
  ctx.fill();
}

// icon: triunghi spre dreapta 
function drawSkipNextIcon(rect, centerY) {
  ctx.beginPath();

  // triunghi spre dreapta
  ctx.moveTo(rect.x + 6, centerY - 11);
  ctx.lineTo(rect.x + rect.w - 10, centerY);
  ctx.lineTo(rect.x + 6, centerY + 11);
  ctx.closePath();
  ctx.fill();
}

function drawControls() {
  const w = canvas.width;
  const h = canvas.height;
  const barHeight = 60;
  const centerY = h - barHeight / 2;
  const btnSize = 30;

  // fundal semitransparent
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, h - barHeight, w, barHeight);
  ctx.restore();

  // zone butoane, “poziția controalelor”
  ui.prevRect = { x: 20, y: centerY - btnSize / 2, w: btnSize, h: btnSize };
  ui.playRect = { x: 60, y: centerY - btnSize / 2, w: btnSize, h: btnSize };
  ui.nextRect = { x: 100, y: centerY - btnSize / 2, w: btnSize, h: btnSize };

  ctx.fillStyle = "#fff";

  // PREV (skip)
  drawSkipPrevIcon(ui.prevRect, centerY);

  // PLAY / PAUSE
  if (video.paused) {
    ctx.beginPath();
    ctx.moveTo(ui.playRect.x + 9, centerY - 12);
    ctx.lineTo(ui.playRect.x + 9, centerY + 12);
    ctx.lineTo(ui.playRect.x + 23, centerY);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(ui.playRect.x + 9, centerY - 12, 5, 24);
    ctx.fillRect(ui.playRect.x + 18, centerY - 12, 5, 24);
  }

  // NEXT (skip)
  drawSkipNextIcon(ui.nextRect, centerY);

  // PROGRESS BAR
  const progressX = 160;
  const progressW = w - 320;
  const progressY = h - 30;
  const progressH = 8;

  ui.progressRect = { x: progressX, y: progressY - 6, w: progressW, h: progressH + 12 };

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(progressX, progressY, progressW, progressH);

  if (video.duration) {
    const frac = clamp(video.currentTime / video.duration, 0, 1);
    ctx.fillStyle = "rgba(0,150,255,0.9)";
    ctx.fillRect(progressX, progressY, progressW * frac, progressH);
  }

  // VOLUM
  const volumeX = w - 120;
  const volumeW = 80;
  const volumeY = h - 30;
  const volumeH = 6;

  ui.volumeRect = { x: volumeX, y: volumeY - 6, w: volumeW, h: volumeH + 12 };

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(volumeX, volumeY, volumeW, volumeH);
  ctx.fillStyle = "rgba(0,255,100,0.9)";
  ctx.fillRect(volumeX, volumeY, volumeW * video.volume, volumeH);

  // timp curent / durată
  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "left";
  const cur = Number.isNaN(video.currentTime) ? 0 : video.currentTime;
  const dur = Number.isNaN(video.duration) ? 0 : video.duration;
  ctx.fillText(`${formatTime(cur)} / ${formatTime(dur)}`, progressX, h - 40);
}

// când video de preview a ajuns la timpul cerut
previewVideo.addEventListener("seeked", () => {
  lastPreviewTimeDrawn = previewTime;
});

function drawPreview() {
  if (!hoveringProgress || previewTime === null || !video.duration) return;
  if (lastPreviewTimeDrawn === null) return;

  const thumbW = 120;
  const thumbH = 80;

  const x = clamp(
    hoverX - thumbW / 2,
    ui.progressRect.x,
    ui.progressRect.x + ui.progressRect.w - thumbW
  );
  const y = ui.progressRect.y - thumbH - 10;

  ctx.save();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(x - 2, y - 2, thumbW + 4, thumbH + 4);
  ctx.strokeRect(x - 2, y - 2, thumbW + 4, thumbH + 4);

  if (previewVideo.readyState >= 2) {
    ctx.drawImage(previewVideo, x, y, thumbW, thumbH);
  }

  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(x, y - 18, thumbW, 16);
  ctx.fillStyle = "#fff";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(formatTime(previewTime), x + thumbW / 2, y - 6);
  ctx.restore();
}

/* ==================== DESENARE LOOP ==================== */

function drawLoop() {
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  if (video.readyState >= 2) {
    ctx.drawImage(video, 0, 0, w, h);

    if (currentEffect !== "none") {
      const frame = ctx.getImageData(0, 0, w, h);
      const processed = applyEffect(frame);
      ctx.putImageData(processed, 0, 0);
    }
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.font = "20px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Se încarcă video...", 20, 40);
  }

  // subtitrări
  const sub = getCurrentSubtitle(video.currentTime || 0);
  if (sub) {
    const padding = 10;
    ctx.font = "18px sans-serif";
    ctx.textAlign = "left";

    const textWidth = ctx.measureText(sub.text).width;
    const boxW = textWidth + padding * 2;
    const boxH = 28;
    const boxX = (w - boxW) / 2;
    const boxY = h - 90;

    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = "#fff";
    ctx.fillText(sub.text, boxX + padding, boxY + 20);
  }

  drawControls();
  drawPreview();

  rafId = requestAnimationFrame(drawLoop);
}

/* ==================== WEB STORAGE ==================== */

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_VOLUME_KEY, String(video.volume));
    localStorage.setItem(STORAGE_INDEX_KEY, String(currentIndex));
  } catch {}
}

function loadSettings() {
  try {
    const v = parseFloat(localStorage.getItem(STORAGE_VOLUME_KEY));
    video.volume = !Number.isNaN(v) ? clamp(v, 0, 1) : 0.7;

    const i = parseInt(localStorage.getItem(STORAGE_INDEX_KEY), 10);
    if (!Number.isNaN(i) && i >= 0 && i < playlist.length) currentIndex = i;
  } catch {
    video.volume = 0.7;
    currentIndex = 0;
  }
}

/* ==================== INITIALIZARE ==================== */

function init() {
  renderPlaylist();
  loadSettings();
  loadVideo(currentIndex, false);

  if (rafId === null) rafId = requestAnimationFrame(drawLoop);

  video.addEventListener("volumechange", saveSettings);
}

document.addEventListener("DOMContentLoaded", init);