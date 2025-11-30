console.log('Offscreen script loaded');

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('Offscreen received message:', message.action);
  if (message.action === 'START') {
    console.log('Starting recording with streamId:', message.streamId);
    startRecording(message.streamId);
  } else if (message.action === 'STOP') {
    console.log('Stopping recording');
    stopRecording();
  }
});

let mediaRecorder;
let recordedChunks = [];
let stream;
let isRecording = false;
let maxRecordingTime = 90 * 1000; // 90 seconds max
let recordingTimer = null;

function startRecording(streamId) {
  console.log('Got streamId, getting MediaStream...');
  navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    }
  }).then((mediaStream) => {
    console.log('Stream received, creating MediaRecorder...');
    stream = mediaStream;
    isRecording = true;
    
    // Use timeslice to prevent memory issues - emit data every 1 second
    mediaRecorder = new MediaRecorder(mediaStream, { 
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 64000 // Reduce bitrate for longer recordings
    });

    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      console.log('Data available, size:', event.data.size);
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
      // Clear old chunks periodically to manage memory
      if (recordedChunks.length > 100) {
        recordedChunks = recordedChunks.slice(-50); // Keep last 50 chunks
      }
    };

    mediaRecorder.onstop = () => {
      console.log('MediaRecorder stopped, processing data...');
      isRecording = false;
      processAndSendData();
    };

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
      isRecording = false;
      chrome.runtime.sendMessage({
        action: 'ERROR',
        error: 'Recording error: ' + event.error.message
      });
    };

    console.log('Starting MediaRecorder...');
    mediaRecorder.start(1000); // Emit data every 1 second
    
    // Set maximum recording time to prevent infinite recording
    recordingTimer = setTimeout(() => {
      if (isRecording) {
        console.log('Max recording time reached, stopping...');
        stopRecording();
      }
    }, maxRecordingTime);

  }).catch((error) => {
    console.error('Error getting user media:', error);
    isRecording = false;
    chrome.runtime.sendMessage({
      action: 'ERROR',
      error: error.message
    });
  });
}

function stopRecording() {
  console.log('Stopping recording, MediaRecorder state:', mediaRecorder?.state);
  
  if (recordingTimer) {
    clearTimeout(recordingTimer);
    recordingTimer = null;
  }
  
  if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
    mediaRecorder.stop();
  }
  
  if (stream) {
    stream.getTracks().forEach(track => {
      track.stop();
    });
    stream = null;
  }
}

function processAndSendData() {
  console.log('Processing data, chunks:', recordedChunks.length);
  if (recordedChunks.length === 0) {
    console.log('No recorded chunks found');
    isRecording = false;
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
    // Clear data after sending to free memory
    recordedChunks = [];
    isRecording = false;
  };
  reader.onerror = function() {
    console.error('FileReader error:', reader.error);
    isRecording = false;
  };
  reader.readAsDataURL(blob);
}