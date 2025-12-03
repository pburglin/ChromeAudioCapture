let recordingState = false;
let lastError = null;
const recordingChunks = new Map(); // Store chunks by recordingId

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
 if (message.action === 'START_RECORDING') {
 lastError = null; // Clear previous errors
 await startRecording(message.streamId);
 sendResponse({ success: true });
 } else if (message.action === 'STOP_RECORDING') {
 await stopRecording();
 sendResponse({ success: true });
 } else if (message.action === 'SAVE_RECORDING') {
 // Legacy single-message save (kept for backwards compatibility)
 console.log('Received SAVE_RECORDING message, data length:', message.data ? message.data.length : 'null');
 handleSave(message.data);
 } else if (message.action === 'SAVE_RECORDING_CHUNK') {
 handleChunk(message);
 } else if (message.action === 'GET_STATUS') {
 sendResponse({ isRecording: recordingState, error: lastError });
 } else if (message.action === 'CLEAR_ERROR') {
 lastError = null;
 chrome.action.setBadgeText({ text: '' });
 sendResponse({ success: true });
 } else if (message.action === 'ERROR') {
 console.error('Offscreen Error:', message.error);
 lastError = message.error;
 chrome.action.setBadgeText({ text: 'ERR' });
 chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
 }
 });

function handleChunk(message) {
 const { recordingId, chunkIndex, totalChunks, data, mimeType } = message;
 console.log(`Received chunk ${chunkIndex + 1}/${totalChunks} for recording ${recordingId}`);
 
 if (!recordingChunks.has(recordingId)) {
   recordingChunks.set(recordingId, {
     chunks: new Array(totalChunks),
     received: 0,
     mimeType: mimeType
   });
 }
 
 const recording = recordingChunks.get(recordingId);
 recording.chunks[chunkIndex] = data;
 recording.received++;
 
 // Check if all chunks received
 if (recording.received === totalChunks) {
   console.log(`All ${totalChunks} chunks received for recording ${recordingId}, assembling...`);
   assembleAndSave(recordingId);
 }
}

async function assembleAndSave(recordingId) {
 const recording = recordingChunks.get(recordingId);
 if (!recording) return;
 
 try {
   // Convert base64 chunks back to binary and combine
   const binaryChunks = [];
   for (const base64Data of recording.chunks) {
     // Extract the base64 content after the data URL prefix
     const base64Content = base64Data.split(',')[1];
     const binaryString = atob(base64Content);
     const bytes = new Uint8Array(binaryString.length);
     for (let i = 0; i < binaryString.length; i++) {
       bytes[i] = binaryString.charCodeAt(i);
     }
     binaryChunks.push(bytes);
   }
   
   // Combine all chunks
   const totalLength = binaryChunks.reduce((sum, chunk) => sum + chunk.length, 0);
   const combined = new Uint8Array(totalLength);
   let offset = 0;
   for (const chunk of binaryChunks) {
     combined.set(chunk, offset);
     offset += chunk.length;
   }
   
   // Create blob and download
   const blob = new Blob([combined], { type: recording.mimeType });
   const url = URL.createObjectURL(blob);
   
   const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
   const filename = `recording-${timestamp}.webm`;
   
   chrome.downloads.download({
     url: url,
     filename: filename,
     saveAs: false
   }, (downloadId) => {
     // Clean up the object URL after download starts
     setTimeout(() => URL.revokeObjectURL(url), 10000);
   });
   
   // Clean up stored chunks
   recordingChunks.delete(recordingId);
   console.log(`Recording ${recordingId} saved successfully`);
 } catch (error) {
   console.error('Error assembling recording:', error);
   lastError = 'Failed to save recording: ' + error.message;
   chrome.action.setBadgeText({ text: 'ERR' });
   chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
   recordingChunks.delete(recordingId);
 }
}

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
 const filename = `recording-${timestamp}.webm`;

 chrome.downloads.download({
 url: base64Data,
 filename: filename,
 saveAs: false
 });
}