# Canvas-Video-Player
A web-based video player built with plain JavaScript and the HTML5 Canvas API, featuring custom canvas-rendered controls, playlist management, video effects, frame preview, and JSON-based subtitles.

## Features

### Playlist Management
- Initial playlist with a minimum of 4 videos stored locally
- Playlist navigation by clicking items
- **Automatic playback of the next video** when the current one ends
- **Drag & drop reordering** of playlist items
- **Remove videos** from the playlist

### Adding Videos
- Add new videos using:
  - file input control
  - **drag & drop**
- When dragging files, a subtitle `.json` file with the same name is automatically associated with the video (if present)

### Canvas-Based Player Controls
All controls are drawn and handled directly on a single **canvas**, overlaid on the video:
- previous / play–pause / next
- progress bar with click-to-seek
- volume control
- semi-transparent UI layer
- interaction determined by cursor position (manual hit testing)

### Frame Preview (Progress Bar Hover)
- Hovering over the progress bar displays a video frame preview and timestamp
- Implemented using a secondary hidden `<video>` element dedicated to preview rendering

### Video Effects (Pixel Processing)
- Real-time video effects applied via pixel manipulation
- Implemented using `getImageData` / `putImageData` (**no CSS filters**)
- Example effects:
  - Mirror
  - Brightness
  - Posterize

### Subtitles
- Subtitles loaded from **JSON files**
- Rendered directly on the canvas and synchronized with playback

### Persistence
- Playback volume stored in `localStorage`
- Current playlist index stored in `localStorage`

---

## Project Structure

.
├── 2_1090_GRIGORE_ANA_MIRUNA.html
├── 2_1090_GRIGORE_ANA_MIRUNA.css
├── 2_1090_GRIGORE_ANA_MIRUNA.js
└── media/


> **Note:**  
> The media files included in this repository are **royalty-free / public domain** assets (Pond5), used strictly for educational and portfolio purposes.  
> The player also supports adding custom videos and subtitles via drag & drop.

---

## Running the Project

### Option 1: Live Server (recommended)
1. Open the project folder in VS Code
2. Right-click the `.html` file → **Open with Live Server**

### Option 2: Local HTTP server

python -m http.server 8000
Then open http://localhost:8000 in your browser.

## Subtitle Format (JSON)
[
  { "start": 0.0, "end": 2.4, "text": "Hello!" },
  { "start": 2.5, "end": 5.0, "text": "Subtitle example" }
]

## Technologies Used
HTML5 Video

Canvas 2D API

JavaScript (Vanilla)

Drag & Drop API

Web Storage (localStorage)

## Improvements
Keyboard shortcuts (space, arrows)

Fullscreen canvas support

Additional video effects (blur, edge detection, grayscale)

Playlist export/import (JSON)

📄 License
Educational and portfolio use only.
Media files are royalty-free / public domain.
