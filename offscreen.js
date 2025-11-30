
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
let audioWorkletNode;
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

// Load the AudioWorklet processor
await audioContext.audioWorklet.addModule('recorder-processor.js');

const source = audioContext.createMediaStreamSource(mediaStream);

// Initialize LameJS Encoder
if (typeof lamejs === 'undefined') {
  console.error('lamejs not found. Please populate lib/lame.min.js');
  return;
}

mp3Encoder = new lamejs.Mp3Encoder(1, sampleRate, kbps);
dataBuffer = []; // Clear buffer

// Create AudioWorkletNode
audioWorkletNode = new AudioWorkletNode(audioContext, 'recorder-processor');

// Handle audio data from the worklet
audioWorkletNode.port.onmessage = (event) => {
  const inputData = event.data; // Float32Array from processor
  
  // Convert Float32 to Int16 for LameJS
  const inputInt16 = convertFloat32ToInt16(inputData);
  
  // Encode
  const mp3Data = mp3Encoder.encodeBuffer(inputInt16);
  if (mp3Data.length > 0) {
    dataBuffer.push(mp3Data);
  }
};

source.connect(audioWorkletNode);
audioWorkletNode.connect(audioContext.destination); // Play audio to user while recording

} catch (err) {
console.error('Error starting recording:', err);
}
}

function stopRecording() {
if (audioWorkletNode) {
audioWorkletNode.disconnect();
audioWorkletNode = null;
}

if (audioContext) {
audioContext.close();
audioContext = null;
}

if (mediaStream) {
mediaStream.getTracks().forEach(track => track.stop());
mediaStream = null;
}

// Finalize MP3 encoding
if (mp3Encoder) {
const mp3Data = mp3Encoder.flush();
if (mp3Data.length > 0) {
dataBuffer.push(mp3Data);
}
mp3Encoder = null;
}

// Create Blob
const blob = new Blob(dataBuffer, { type: 'audio/mp3' });

// Convert to Base64 to send to Background
const reader = new FileReader();
reader.onload = function() {
chrome.runtime.sendMessage({
action: 'SAVE_RECORDING',
data: reader.result // Data URL
});
// Clear buffer after save
dataBuffer = [];
};
reader.readAsDataURL(blob);
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

