
console.log('Offscreen script loaded');

// Handle direct connections from Popup for visualization
let activePorts = new Set();
let analyser = null;
let visualizationInterval = null;

chrome.runtime.onConnect.addListener((port) => {
if (port.name === 'visualization') {
console.log('Popup connected for visualization');
activePorts.add(port);

// Start sending data if we are recording
startVisualizationLoop();

port.onDisconnect.addListener(() => {
  console.log('Popup disconnected');
  activePorts.delete(port);
  if (activePorts.size === 0) {
    stopVisualizationLoop();
  }
});

}
});

function startVisualizationLoop() {
if (visualizationInterval || !analyser || activePorts.size === 0) return;

const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

// Send data at \~30fps
visualizationInterval = setInterval(() => {
if (!analyser) return;

analyser.getByteFrequencyData(dataArray);

// Optimize: Downsample to ~16-32 bars for the UI to reduce message size
// We'll send a smaller array
const bands = 32;
const step = Math.floor(bufferLength / bands);
const simplifiedData = new Array(bands);

for (let i = 0; i < bands; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j];
    }
    simplifiedData[i] = Math.floor(sum / step);
}

const message = {
    type: 'VISUALIZER_DATA',
    data: simplifiedData
};

for (const port of activePorts) {
  try {
    port.postMessage(message);
  } catch (e) {
    console.error('Error posting to port:', e);
    activePorts.delete(port);
  }
}

}, 33);
}

function stopVisualizationLoop() {
if (visualizationInterval) {
clearInterval(visualizationInterval);
visualizationInterval = null;
}
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
console.log('Offscreen received message:', message.action);
if (message.action === 'START') {
console.log('Starting recording with streamId:', message.streamId);
startRecording(message.streamId);
} else if (message.action === 'STOP') {
console.log('Stopping recording');
stopRecording();
}
});

let mediaRecorder;
let recordedChunks = [];
let stream;
let isRecording = false;
let maxRecordingTime = 90 * 1000; // 90 seconds max
let recordingTimer = null;
let audioContext = null;
let source = null;

async function startRecording(streamId) {
try {
console.log('Got streamId, getting MediaStream...');
const mediaStream = await navigator.mediaDevices.getUserMedia({
audio: {
mandatory: {
chromeMediaSource: 'tab',
chromeMediaSourceId: streamId
}
},
video: false
});

console.log('Stream received');
stream = mediaStream;
isRecording = true;

// --- Audio Context & Analyser Setup ---
audioContext = new AudioContext();
source = audioContext.createMediaStreamSource(stream);
analyser = audioContext.createAnalyser();
analyser.fftSize = 256; // Small FFT size for simple visualization
analyser.smoothingTimeConstant = 0.5;

// Connect graph: Source -> Analyser -> Destination (to keep audio playing/active)
// Note: To record, we still use MediaRecorder on the original stream 
// OR we could use AudioWorklet. Since we already have MediaRecorder logic,
// let's stick to MediaRecorder for capturing, and AudioContext ONLY for visualization.
// However, connecting to destination might double audio? 
// 'tab' capture usually mutes the tab. We MUST connect to destination to hear it.
source.connect(analyser);
analyser.connect(audioContext.destination);

// Start sending visual data if popup is open
startVisualizationLoop();

// --- Recorder Setup ---
// Use timeslice to prevent memory issues - emit data every 1 second
mediaRecorder = new MediaRecorder(mediaStream, { 
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 128000
});

recordedChunks = [];

mediaRecorder.ondataavailable = (event) => {
  if (event.data.size > 0) {
    recordedChunks.push(event.data);
  }
  // Clear old chunks periodically to manage memory
  if (recordedChunks.length > 200) {
    recordedChunks = recordedChunks.slice(-100); 
  }
};

mediaRecorder.onstop = () => {
  console.log('MediaRecorder stopped, processing data...');
  isRecording = false;
  processAndSendData();
  
  // Cleanup AudioContext
  if (audioContext) {
    audioContext.close();
    audioContext = null;
    analyser = null;
    stopVisualizationLoop();
  }
};

mediaRecorder.onerror = (event) => {
  console.error('MediaRecorder error:', event.error);
  isRecording = false;
  chrome.runtime.sendMessage({
    action: 'ERROR',
    error: 'Recording error: ' + event.error.message
  });
};

console.log('Starting MediaRecorder...');
mediaRecorder.start(1000); 

// Set maximum recording time to prevent infinite recording
recordingTimer = setTimeout(() => {
  if (isRecording) {
    console.log('Max recording time reached, stopping...');
    stopRecording();
  }
}, maxRecordingTime);

} catch (error) {
console.error('Error getting user media:', error);
isRecording = false;
chrome.runtime.sendMessage({
action: 'ERROR',
error: error.message
});
}
}

function stopRecording() {
console.log('Stopping recording, MediaRecorder state:', mediaRecorder?.state);

if (recordingTimer) {
clearTimeout(recordingTimer);
recordingTimer = null;
}

if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
mediaRecorder.stop();
}

if (stream) {
stream.getTracks().forEach(track => {
track.stop();
});
stream = null;
}
}

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks to avoid Base64 string limits

async function processAndSendData() {
console.log('Processing data, chunks:', recordedChunks.length);
if (recordedChunks.length === 0) {
console.log('No recorded chunks found');
isRecording = false;
return;
}

const blob = new Blob(recordedChunks, { type: 'audio/webm;codecs=opus' });
console.log('Created blob, size:', blob.size);

// Generate unique recording ID
const recordingId = Date.now().toString(36) + Math.random().toString(36).substr(2);
const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);

console.log(`Sending ${totalChunks} chunks for recording ${recordingId}`);

try {
// Send chunks sequentially
for (let i = 0; i < totalChunks; i++) {
const start = i * CHUNK_SIZE;
const end = Math.min(start + CHUNK_SIZE, blob.size);
const chunkBlob = blob.slice(start, end);

  const chunkData = await blobToBase64(chunkBlob);
  
  chrome.runtime.sendMessage({
    action: 'SAVE_RECORDING_CHUNK',
    recordingId: recordingId,
    chunkIndex: i,
    totalChunks: totalChunks,
    data: chunkData,
    mimeType: 'audio/webm;codecs=opus'
  });
  
  console.log(`Sent chunk ${i + 1}/${totalChunks}`);
}

// Clear data after sending to free memory
recordedChunks = [];
isRecording = false;

} catch (error) {
console.error('Error processing recording:', error);
isRecording = false;
chrome.runtime.sendMessage({
action: 'ERROR',
error: 'Failed to process recording: ' + error.message
});
}
}

function blobToBase64(blob) {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = () => resolve(reader.result);
reader.onerror = () => reject(reader.error);
reader.readAsDataURL(blob);
});
}

