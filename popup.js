document.addEventListener('DOMContentLoaded', async () => {
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const recordingIndicator = document.getElementById('recordingIndicator');
const errorContainer = document.getElementById('errorContainer');
const errorMessage = document.getElementById('errorMessage');
const dismissErrorBtn = document.getElementById('dismissError');

// Check current status
chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
if (response) {
  if (response.isRecording) {
    updateUI(true);
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

// 1. Get the Stream ID for the active tab
// This permission requires interaction, so we do it in the popup
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

console.log('Getting media stream ID for tab:', tab.id);
chrome.tabCapture.getMediaStreamId({
targetTabId: tab.id
}, (streamId) => {
if (chrome.runtime.lastError) {
console.error('getMediaStreamId error:', chrome.runtime.lastError);
showError(chrome.runtime.lastError.message);
return;
}

console.log('Got streamId:', streamId);
// 2. Tell background to start recording with this stream ID
chrome.runtime.sendMessage({
action: 'START_RECORDING',
streamId: streamId
}, () => {
updateUI(true);
});
});
});

stopBtn.addEventListener('click', async () => {
console.log('Stop button clicked');
statusDiv.textContent = 'Stopping...';

// Send stop message multiple times to ensure it gets through
chrome.runtime.sendMessage({ action: 'STOP_RECORDING' }, () => {
// First attempt
setTimeout(() => {
chrome.runtime.sendMessage({ action: 'STOP_RECORDING' });
}, 500);

setTimeout(() => {
chrome.runtime.sendMessage({ action: 'STOP_RECORDING' });
}, 1000);

setTimeout(() => {
chrome.runtime.sendMessage({ action: 'STOP_RECORDING' });
}, 1500);
});
updateUI(false);
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

// Check for recording state updates and errors
setInterval(() => {
chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
if (response) {
  const isCurrentlyRecording = response.isRecording;
  const shouldShowRecording = isCurrentlyRecording && startBtn.disabled === false;

  if (shouldShowRecording) {
    updateUI(true);
  }
  
  // Show error if there's a new one
  if (response.error && errorContainer.classList.contains('hidden')) {
    showError(response.error);
  }
}
});
}, 1000);
});