document.addEventListener('DOMContentLoaded', async () => {
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');

// Check current status
chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
if (response && response.isRecording) {
updateUI(true);
}
});

startBtn.addEventListener('click', async () => {
// 1. Get the Stream ID for the active tab
// This permission requires interaction, so we do it in the popup
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

console.log('Getting media stream ID for tab:', tab.id);
chrome.tabCapture.getMediaStreamId({
targetTabId: tab.id
}, (streamId) => {
if (chrome.runtime.lastError) {
console.error('getMediaStreamId error:', chrome.runtime.lastError);
statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
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
} else {
startBtn.disabled = false;
stopBtn.disabled = true;
statusDiv.textContent = 'Ready';
}
}

// Check for recording state updates
setInterval(() => {
chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
const isCurrentlyRecording = response && response.isRecording;
const shouldShowRecording = isCurrentlyRecording && startBtn.disabled === false;

if (shouldShowRecording) {
updateUI(true);
}
});
}, 1000);
});