Develop a Chrome extension that captures all audio played in the currently active tab, streams it to an in‑browser encoder to convert to MP3, and automatically stores the resulting MP3 files in the user's local filesystem (e.g., the Downloads folder) via the Offscreen API, includes a popup UI with start/stop controls and a list of saved recordings with timestamps and file sizes, requests the necessary permissions (activeTab, tabCapture, downloads), and gracefully handles audio from multiple sources, hidden tabs, and network streams.

For audio recording in MP3, you should use the Offscreen API.
The background script opens a hidden offscreen document (offscreen.html).
The offscreen document runs the chrome.tabCapture logic.
Because it is a document (DOM), it can keep the MediaRecorder alive and won't be killed like a Service Worker.