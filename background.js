
let recordingState = false;

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
if (message.action === 'START_RECORDING') {
await startRecording(message.streamId);
sendResponse({ success: true });
} else if (message.action === 'STOP_RECORDING') {
await stopRecording();
sendResponse({ success: true });
} else if (message.action === 'SAVE_RECORDING') {
handleSave(message.data);
} else if (message.action === 'GET_STATUS') {
sendResponse({ isRecording: recordingState });
} else if (message.action === 'ERROR') {
console.error('Offscreen Error:', message.error);
// Optionally notify user via badge or notification
chrome.action.setBadgeText({ text: 'ERR' });
chrome.action.setBadgeBackgroundColor({ color: '\#000000' });
}
});

async function startRecording(streamId) {
if (recordingState) return;

const existingContexts = await chrome.runtime.getContexts({
contextTypes: ['OFFSCREEN_DOCUMENT']
});

if (existingContexts.length === 0) {
await chrome.offscreen.createDocument({
url: 'offscreen.html',
reasons: ['USER_MEDIA'],
justification: 'Recording tab audio'
});
}

chrome.runtime.sendMessage({
target: 'offscreen',
action: 'START',
streamId: streamId
});

recordingState = true;
chrome.action.setBadgeText({ text: 'REC' });
chrome.action.setBadgeBackgroundColor({ color: '\#FF0000' });
}

async function stopRecording() {
if (!recordingState) return;

chrome.runtime.sendMessage({
target: 'offscreen',
action: 'STOP'
});

recordingState = false;
chrome.action.setBadgeText({ text: '' });
}

function handleSave(base64Data) {
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const filename = `recording-${timestamp}.mp3`;

chrome.downloads.download({
url: base64Data,
filename: filename,
saveAs: false
});
}

