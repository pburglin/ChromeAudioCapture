
// Listen for messages from the background script
chrome.runtime.onMessage.addListener(async (message) => {
if (message.target !== 'offscreen') return;

if (message.action === 'START') {
startRecording(message.streamId);
} else if (message.action === 'STOP') {
stopRecording();
}
});

let audioContext;
let mediaStream;
let processor;
let mp3Encoder;
let dataBuffer = [];
let sampleRate = 44100;
let kbps = 128;

async function startRecording(streamId) {
try {
// Acquire media stream using the ID passed from popup -> background -> here
mediaStream = await navigator.mediaDevices.getUserMedia({
audio: {
mandatory: {
chromeMediaSource: 'tab',
chromeMediaSourceId: streamId
}
},
video: false
});

// Initialize Audio Context
audioContext = new AudioContext({ sampleRate: sampleRate });
const source = audioContext.createMediaStreamSource(mediaStream);

// Initialize LameJS Encoder
// Assumes lamejs is loaded globally via <script> tag in offscreen.html
if (typeof lamejs === 'undefined') {
  console.error('lamejs not found. Please populate lib/lame.min.js');
  return;
}

mp3Encoder = new lamejs.Mp3Encoder(1, sampleRate, kbps);
dataBuffer = []; // Clear buffer

// Use ScriptProcessorNode (deprecated but effective for non-Worklet simple implementations)
// Buffer size 4096 is a good balance between latency and performance
processor = audioContext.createScriptProcessor(4096, 1, 1);

processor.onaudioprocess = (event) => {
  const inputData = event.inputBuffer.getChannelData(0);
  
  // Convert Float32 to Int16 for LameJS
  const inputInt16 = convertFloat32ToInt16(inputData);
  
  // Encode
  const mp3Data = mp3Encoder.encodeBuffer(inputInt16);
  if (mp3Data.length > 0) {
    dataBuffer.push(mp3Data);
  }
};

source.connect(processor);
processor.connect(audioContext.destination); // Needed for chrome audio to keep playing? 
// Actually, connecting to destination might cause echo if not handled carefully (tab audio -> mic -> speaker).
// In tabCapture, we often want to mute the original or let it play.
// However, createScriptProcessor needs connection to destination to fire events in some browsers.
// To mute self-playback but keep recording: connect to a GainNode with gain 0, then destination.

// BUT: chrome.tabCapture automatically mutes the tab in the main view unless we play it here.
// So we usually WANT to connect it to destination so the user hears the audio while recording.

} catch (err) {
console.error('Error starting recording:', err);
}
}

function stopRecording() {
if (processor && audioContext) {
processor.disconnect();
audioContext.close();
}

if (mediaStream) {
mediaStream.getTracks().forEach(track => track.stop());
}

// Finalize MP3 encoding
if (mp3Encoder) {
const mp3Data = mp3Encoder.flush();
if (mp3Data.length > 0) {
dataBuffer.push(mp3Data);
}
}

// Create Blob
const blob = new Blob(dataBuffer, { type: 'audio/mp3' });

// Convert to Base64 to send to Background (chrome.downloads isn't in offscreen)
const reader = new FileReader();
reader.onload = function() {
chrome.runtime.sendMessage({
action: 'SAVE_RECORDING',
data: reader.result // Data URL
});
};
reader.readAsDataURL(blob);

// Cleanup
mp3Encoder = null;
dataBuffer = [];
}

function convertFloat32ToInt16(float32Array) {
const len = float32Array.length;
const int16Array = new Int16Array(len);
for (let i = 0; i < len; i++) {
// Clamp values to [-1, 1]
let s = Math.max(-1, Math.min(1, float32Array[i]));
// Scale to 16-bit signed integer range
int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
}
return int16Array;
}

