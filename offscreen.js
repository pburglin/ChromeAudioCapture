
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
if (typeof lamejs === 'undefined') {
throw new Error('lamejs library not found. Please ensure lib/lame.min.js is populated.');
}

// Acquire media stream
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
// Use the system sample rate to avoid resampling artifacts/issues
audioContext = new AudioContext(); 
sampleRate = audioContext.sampleRate;
await audioContext.resume();

// Load the AudioWorklet processor
try {
  await audioContext.audioWorklet.addModule('recorder-processor.js');
} catch (e) {
  throw new Error('Failed to load recorder-processor.js: ' + e.message);
}

const source = audioContext.createMediaStreamSource(mediaStream);

mp3Encoder = new lamejs.Mp3Encoder(1, sampleRate, kbps);
dataBuffer = []; 

audioWorkletNode = new AudioWorkletNode(audioContext, 'recorder-processor');

audioWorkletNode.port.onmessage = (event) => {
  const inputData = event.data;
  if (!inputData) return;

  const inputInt16 = convertFloat32ToInt16(inputData);
  
  // lamejs expects Int16Array
  const mp3Data = mp3Encoder.encodeBuffer(inputInt16);
  if (mp3Data.length > 0) {
    dataBuffer.push(mp3Data);
  }
};

source.connect(audioWorkletNode);
audioWorkletNode.connect(audioContext.destination);

console.log('Recording started. Sample rate:', sampleRate);

} catch (err) {
console.error('Error starting recording:', err);
chrome.runtime.sendMessage({
action: 'ERROR',
error: err.message
});
}
}

function stopRecording() {
if (audioWorkletNode) {
audioWorkletNode.disconnect();
audioWorkletNode = null;
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

if (audioContext) {
audioContext.close();
audioContext = null;
}

if (dataBuffer.length === 0) {
console.warn('Buffer is empty. No audio recorded.');
chrome.runtime.sendMessage({
action: 'ERROR',
error: 'No audio data captured. Check if audio is playing or lamejs is working.'
});
return;
}

const blob = new Blob(dataBuffer, { type: 'audio/mp3' });

const reader = new FileReader();
reader.onload = function() {
chrome.runtime.sendMessage({
action: 'SAVE_RECORDING',
data: reader.result
});
dataBuffer = [];
};
reader.readAsDataURL(blob);
}

function convertFloat32ToInt16(float32Array) {
const len = float32Array.length;
const int16Array = new Int16Array(len);
for (let i = 0; i < len; i++) {
let s = Math.max(-1, Math.min(1, float32Array[i]));
int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
}
return int16Array;
}

