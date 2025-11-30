
let recordingState = false;

// Listen for messages from Popup and Offscreen documents
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
}
});

async function startRecording(streamId) {
if (recordingState) return;

// Ensure offscreen document exists
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

// Get the stream ID for the current active tab if not provided
// Note: tabCapture.getMediaStreamId must be called here or in popup
// We expect popup to pass the streamId or we generate it here if triggered by shortcut

// Send command to offscreen
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

// Close offscreen document to save resources?
// Better to keep it open briefly to process encoding,
// but for this implementation we rely on offscreen to handle cleanup.
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

