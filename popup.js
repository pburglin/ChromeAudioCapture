
document.addEventListener('DOMContentLoaded', async () => {
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const recordingIndicator = document.getElementById('recordingIndicator');
const errorContainer = document.getElementById('errorContainer');
const errorMessage = document.getElementById('errorMessage');
const dismissErrorBtn = document.getElementById('dismissError');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');

let visualizerPort = null;

// Clear canvas initially
canvasCtx.fillStyle = '\#f5f5f5';
canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

// Check current status
chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
if (response) {
if (response.isRecording) {
updateUI(true);
connectVisualizer();
}
if (response.error) {
showError(response.error);
}
}
});

// Dismiss error button
dismissErrorBtn.addEventListener('click', () => {
hideError();
chrome.runtime.sendMessage({ action: 'CLEAR_ERROR' });
});

startBtn.addEventListener('click', async () => {
hideError(); // Clear any previous errors

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

chrome.tabCapture.getMediaStreamId({
  targetTabId: tab.id
}, (streamId) => {
  if (chrome.runtime.lastError) {
    showError(chrome.runtime.lastError.message);
    return;
  }
  
  chrome.runtime.sendMessage({ 
    action: 'START_RECORDING', 
    streamId: streamId 
  }, () => {
    updateUI(true);
    connectVisualizer();
  });
});

});

stopBtn.addEventListener('click', async () => {
statusDiv.textContent = 'Stopping...';

chrome.runtime.sendMessage({ action: 'STOP_RECORDING' }, () => {
   // Retry a few times to ensure delivery
   setTimeout(() => chrome.runtime.sendMessage({ action: 'STOP_RECORDING' }), 500);
});

updateUI(false);
disconnectVisualizer();
// Clear visualization
canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
canvasCtx.fillStyle = '#f5f5f5';
canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

});

function updateUI(isRecording) {
if (isRecording) {
startBtn.disabled = true;
stopBtn.disabled = false;
statusDiv.textContent = 'Recording...';
recordingIndicator.classList.remove('hidden');
} else {
startBtn.disabled = false;
stopBtn.disabled = true;
statusDiv.textContent = 'Ready to record';
recordingIndicator.classList.add('hidden');
}
}

function showError(message) {
errorMessage.textContent = message;
errorContainer.classList.remove('hidden');
statusDiv.textContent = 'Error occurred';
}

function hideError() {
errorContainer.classList.add('hidden');
errorMessage.textContent = '';
}

function connectVisualizer() {
if (visualizerPort) return;

try {
    visualizerPort = chrome.runtime.connect({ name: 'visualization' });
    visualizerPort.onMessage.addListener((msg) => {
        if (msg.type === 'VISUALIZER_DATA') {
            drawVisualization(msg.data);
        }
    });
    visualizerPort.onDisconnect.addListener(() => {
        visualizerPort = null;
    });
} catch (e) {
    console.error('Failed to connect visualizer:', e);
}

}

function disconnectVisualizer() {
if (visualizerPort) {
visualizerPort.disconnect();
visualizerPort = null;
}
}

function drawVisualization(data) {
const width = canvas.width;
const height = canvas.height;
const barWidth = (width / data.length) - 2;

canvasCtx.clearRect(0, 0, width, height);

// Background
canvasCtx.fillStyle = '#f5f5f5';
canvasCtx.fillRect(0, 0, width, height);

// Bars
// Use a gradient
const gradient = canvasCtx.createLinearGradient(0, height, 0, 0);
gradient.addColorStop(0, '#4CAF50');
gradient.addColorStop(1, '#81C784');
canvasCtx.fillStyle = gradient;

for (let i = 0; i < data.length; i++) {
    const value = data[i];
    const percent = value / 255;
    const barHeight = height * percent;
    
    // Make it look energetic
    const x = i * (barWidth + 2);
    const y = height - barHeight;
    
    canvasCtx.fillRect(x, y, barWidth, barHeight);
}

}

// Poll status periodically to update UI if closed/reopened
setInterval(() => {
chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
if (response) {
const isCurrentlyRecording = response.isRecording;
// If UI is out of sync (shows Ready but actually Recording)
if (isCurrentlyRecording && startBtn.disabled === false) {
updateUI(true);
connectVisualizer();
}
// If UI shows Recording but actually Stopped
if (!isCurrentlyRecording && startBtn.disabled === true) {
updateUI(false);
disconnectVisualizer();
}

    if (response.error && errorContainer.classList.contains('hidden')) {
      showError(response.error);
    }
  }
});

}, 1000);
});

