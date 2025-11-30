console.log('Offscreen script loaded');

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('Offscreen received message:', message.action);
  if (message.action === 'START') {
    console.log('Starting recording with stream');
    startRecording(message.stream);
  } else if (message.action === 'STOP') {
    console.log('Stopping recording');
    stopRecording();
  }
});

let mediaRecorder;
let recordedChunks = [];

function startRecording(stream) {
  console.log('Got stream, creating MediaRecorder...');
  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      console.log('Data available, size:', event.data.size);
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      console.log('MediaRecorder stopped, processing data...');
      processAndSendData();
    };

    console.log('Starting MediaRecorder...');
    mediaRecorder.start();
  } catch (error) {
    console.error('Error creating MediaRecorder:', error);
    chrome.runtime.sendMessage({
      action: 'ERROR',
      error: error.message
    });
  }
}

function stopRecording() {
  console.log('Stopping recording, MediaRecorder state:', mediaRecorder?.state);
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}

function processAndSendData() {
  console.log('Processing data, chunks:', recordedChunks.length);
  if (recordedChunks.length === 0) {
    console.log('No recorded chunks found');
    return;
  }

  const blob = new Blob(recordedChunks, { type: 'audio/webm;codecs=opus' });
  console.log('Created blob, size:', blob.size);
  const reader = new FileReader();
  reader.onload = function() {
    console.log('FileReader loaded, sending message to background');
    chrome.runtime.sendMessage({
      action: 'SAVE_RECORDING',
      data: reader.result
    });
  };
  reader.readAsDataURL(blob);
}