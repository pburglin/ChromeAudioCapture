
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

// Clear canvas initially with white background
canvasCtx.fillStyle = '\#ffffff';
canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

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
hideError(); // Clear any previous errors
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
    // UI update will happen via polling or immediate check
    updateUI(true);
    connectVisualizer();
  });
});

});

stopBtn.addEventListener('click', async () => {
stopBtn.disabled = true;
statusDiv.textContent = 'Stopping & Saving...';
recordingIndicator.classList.add('hidden');

chrome.runtime.sendMessage({ action: 'STOP_RECORDING' }, () => {
   // Retry a few times to ensure delivery if needed, though usually one is enough
   setTimeout(() => chrome.runtime.sendMessage({ action: 'STOP_RECORDING' }), 500);
});

disconnectVisualizer();
clearVisualization();
// Final UI update will happen via polling when background confirms stop

});

function updateUI(isRecording) {
if (isRecording) {
startBtn.disabled = true;
stopBtn.disabled = false;
statusDiv.textContent = 'Recording Active';
recordingIndicator.classList.remove('hidden');
startBtn.textContent = 'Recording...';
} else {
startBtn.disabled = false;
stopBtn.disabled = true;
statusDiv.textContent = 'Ready to record';
recordingIndicator.classList.add('hidden');
startBtn.textContent = 'Start Recording';
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
            // Use requestAnimationFrame for smoother drawing
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
canvasCtx.fillStyle = '\#ffffff';
canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawVisualization(data) {
const width = canvas.width;
const height = canvas.height;
const barWidth = (width / data.length);

// Clear with white
canvasCtx.fillStyle = '#ffffff';
canvasCtx.fillRect(0, 0, width, height);

// Bars Gradient
const gradient = canvasCtx.createLinearGradient(0, height, 0, 0);
gradient.addColorStop(0, '#4CAF50'); // Green
gradient.addColorStop(1, '#81C784'); // Lighter green
canvasCtx.fillStyle = gradient;

for (let i = 0; i < data.length; i++) {
    const value = data[i];
    const percent = value / 255;
    const barHeight = Math.max(percent * height, 2); // Ensure at least 2px height showing
    
    const x = i * barWidth;
    const y = height - barHeight;
    
    // Draw bar with slight padding between them
    canvasCtx.fillRect(x, y, barWidth - 1, barHeight);
}

}

// Poll status periodically to update UI if closed/reopened
setInterval(() => {
chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
if (response) {
const isCurrentlyRecording = response.isRecording;

    // Sync UI state if it drifted
    if (isCurrentlyRecording && startBtn.disabled === false) {
       updateUI(true);
       connectVisualizer();
    } else if (!isCurrentlyRecording && startBtn.disabled === true) {
       updateUI(false);
       disconnectVisualizer();
    }
    
    // Show error if there's a new one and not currently showing one
    if (response.error && errorContainer.classList.contains('hidden')) {
      showError(response.error);
    }
  }
});

}, 1000);
});

