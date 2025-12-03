
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
let animationId = null;

// Clear canvas initially (Transparent for glass effect)
canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

// Check current status
chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
if (response) {
if (response.isRecording) {
updateUI(true);
connectVisualizer();
} else {
updateUI(false);
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
hideError();
startBtn.disabled = true;
statusDiv.textContent = 'Initializing...';

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

chrome.tabCapture.getMediaStreamId({
  targetTabId: tab.id
}, (streamId) => {
  if (chrome.runtime.lastError) {
    showError(chrome.runtime.lastError.message);
    updateUI(false);
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
stopBtn.disabled = true;
statusDiv.textContent = 'Processing...';
recordingIndicator.classList.add('hidden');

chrome.runtime.sendMessage({ action: 'STOP_RECORDING' }, () => {
   setTimeout(() => chrome.runtime.sendMessage({ action: 'STOP_RECORDING' }), 500);
});

disconnectVisualizer();
clearVisualization();

});

function updateUI(isRecording) {
if (isRecording) {
startBtn.disabled = true;
stopBtn.disabled = false;
statusDiv.textContent = 'Recording Active';
recordingIndicator.classList.remove('hidden');
} else {
startBtn.disabled = false;
stopBtn.disabled = true;
statusDiv.textContent = 'Ready to capture';
recordingIndicator.classList.add('hidden');
}
}

function showError(message) {
errorMessage.textContent = message;
errorContainer.classList.remove('hidden');
statusDiv.textContent = 'Error occurred';
recordingIndicator.classList.add('hidden');
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
            if (animationId) cancelAnimationFrame(animationId);
            animationId = requestAnimationFrame(() => drawVisualization(msg.data));
        }
    });
    visualizerPort.onDisconnect.addListener(() => {
        visualizerPort = null;
        if (animationId) cancelAnimationFrame(animationId);
        clearVisualization();
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
if (animationId) {
cancelAnimationFrame(animationId);
animationId = null;
}
}

function clearVisualization() {
canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawVisualization(data) {
const width = canvas.width;
const height = canvas.height;
const barWidth = (width / data.length);

// Clear canvas to transparent
canvasCtx.clearRect(0, 0, width, height);

// Create a bright, "electric" gradient for the bars to stand out against dark glass
const gradient = canvasCtx.createLinearGradient(0, height, 0, 0);
gradient.addColorStop(0, '#00F260'); // Bright Green
gradient.addColorStop(1, '#0575E6'); // Electric Blue
canvasCtx.fillStyle = gradient;

for (let i = 0; i < data.length; i++) {
    const value = data[i];
    const percent = value / 255;
    // Boost the height slightly for better visibility
    const barHeight = Math.max((percent * height) * 1.2, 3); 
    
    const x = i * barWidth;
    const y = height - barHeight;
    
    // Draw rounded bars
    canvasCtx.fillRect(x + 1, y, barWidth - 2, barHeight);
}

}

// Poll status
setInterval(() => {
chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
if (response) {
const isCurrentlyRecording = response.isRecording;

    if (isCurrentlyRecording && startBtn.disabled === false) {
       updateUI(true);
       connectVisualizer();
    } else if (!isCurrentlyRecording && startBtn.disabled === true) {
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

