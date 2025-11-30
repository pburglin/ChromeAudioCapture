
# Tasks

  - [x] Initialize project structure (`manifest.json`, `background.js`, `popup.html`).
  - [x] Implement Offscreen API setup (`offscreen.html`, `offscreen.js`).
  - [x] Implement Audio Capture logic using `chrome.tabCapture` and `getUserMedia`.
  - [x] Implement MP3 Encoding logic (Stubbed `lamejs` integration).
  - [x] Implement Background Service Worker to handle messages and downloads.
  - [x] Implement Popup UI for Start/Stop controls.
  - [x] Handle file saving via `chrome.downloads`.

## Backlog

  - [x] Add `lame.min.js` to `lib/` (External dependency required for MP3 encoding).
  - [ ] Refactor `ScriptProcessorNode` to `AudioWorklet` (Performance optimization).
  - [ ] Add visualization (waveform) to Popup UI.
  - [ ] Handle very long recordings (Chunked transfer between Offscreen and Background to avoid Base64 string limits).

