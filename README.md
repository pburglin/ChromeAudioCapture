# Tab Audio Recorder

A Chrome extension that records audio from browser tabs and saves them locally as WebM files.

## ✨ Features

- **Tab Audio Capture**: Record audio directly from any browser tab
- **Long Recording Support**: Record for up to 90 seconds without issues
- **Memory Efficient**: Optimized for handling large audio files
- **Automatic Download**: Saves recordings as WebM files with timestamps
- **Stop Anytime**: Control recording start/stop from popup
- **WebM Format**: Uses efficient WebM/Opus codec for good quality and file size

## 🚀 Installation

### Method 1: Load Unpacked Extension (Developer Mode)

1. **Download the Extension**
   - Clone or download this repository to your computer

2. **Enable Developer Mode**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your Chrome toolbar

4. **Grant Permissions**
   - When you first use the extension, Chrome will ask for permission to capture tab audio
   - Click "Allow" to grant the necessary permissions

## 📖 Usage

### Starting a Recording

1. **Keep Popup Open**: ⭐ **IMPORTANT** - Keep the extension popup open during recording
2. **Navigate to Tab**: Go to the tab you want to record audio from
3. **Start Recording**: Click "Start Recording" in the extension popup
4. **Play Audio**: Ensure the tab is playing audio you want to capture
5. **Status Indicator**: Extension icon shows "REC" badge during recording

### Stopping a Recording

1. **Click Stop**: Click "Stop Recording" in the popup
2. **Wait for Processing**: Status will show "Processing & Saving..."
3. **Download Complete**: File will automatically download to your Downloads folder

### File Location

Recordings are saved as:
- **Format**: WebM (WebM/Opus audio codec)
- **Location**: Your browser's Downloads folder
- **Naming**: `recording-YYYY-MM-DDTHH-MM-SS.sssZ.webm`

## 🔧 How It Works

### Technical Details

- **Tab Capture API**: Uses Chrome's `tabCapture` API to access tab audio
- **MediaRecorder**: Records audio using the browser's native MediaRecorder
- **WebM Format**: Efficient audio format with good quality-to-size ratio
- **90-Second Limit**: Safety timeout to prevent infinite recording
- **Memory Management**: Chunked recording with automatic cleanup

### Recording Flow

1. **Popup Request**: User clicks "Start Recording"
2. **Stream ID**: Popup gets tab stream ID via `chrome.tabCapture.getMediaStreamId`
3. **Background Script**: Requests stream and creates offscreen document
4. **Offscreen Recording**: Uses `MediaRecorder` to capture audio chunks
5. **Data Processing**: Chunks are combined and converted to WebM
6. **Download**: Final file is saved via Chrome's downloads API

## ⚠️ Important Notes

### Keep Popup Open

**The extension popup must remain open during recording.** This is because:
- The popup maintains the communication channel with the background script
- Closing the popup breaks the message passing required for tab capture
- This is a Chrome extension limitation, not a bug

### Tab Requirements

- **Audio Must Be Playing**: The tab must be actively playing audio
- **CORS Considerations**: Some websites may block audio capture due to CORS policies
- **System Audio**: Only captures tab audio, not system/microphone audio

### File Information

- **Format**: WebM (cannot be changed to MP3 without external libraries)
- **Quality**: 64kbps Opus codec for efficient compression
- **Duration**: Supports recordings up to 90 seconds
- **Compatibility**: WebM files play in modern browsers and media players

## 🛠️ Troubleshooting

### Recording Fails to Start

1. **Check Tab Audio**: Ensure the tab is playing audio
2. **Permissions**: Verify tab capture permissions are granted
3. **Popup Open**: Make sure extension popup is open
4. **Reload Extension**: Try reloading the extension in `chrome://extensions/`

### Stop Button Not Working

1. **Multiple Clicks**: Try clicking Stop multiple times
2. **Wait for Processing**: Allow time for "Processing & Saving..." to complete
3. **Console Check**: Open Developer Tools (F12) → Console for error messages

### File Not Downloading

1. **Downloads Folder**: Check your browser's Downloads folder
2. **Filename Format**: Look for `recording-[timestamp].webm` files
3. **Permissions**: Ensure extension has download permissions

### Memory Issues During Long Recording

1. **90-Second Limit**: The extension auto-stops at 90 seconds to prevent memory issues
2. **Keep Popup Open**: This helps maintain efficient memory usage
3. **Restart if Needed**: For very long recordings, start a new recording

## 📁 File Structure

```
ChromeAudioCapture/
├── manifest.json          # Extension manifest
├── background.js          # Background service worker
├── popup.html             # Extension popup interface
├── popup.js              # Popup functionality
├── offscreen.html         # Hidden recording page
├── offscreen.js          # Audio recording logic
├── recorder-processor.js  # Audio worklet processor
├── README.md             # This file
└── icons/                # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 🔒 Privacy & Security

- **Local Recording**: All audio stays on your computer
- **No Upload**: Extension does not send data to external servers
- **Tab-Specific**: Only captures audio from the selected tab
- **User Control**: You control when recording starts and stops

## 🤝 Contributing

This extension is provided as-is for educational and personal use. Feel free to modify and improve it according to your needs.

## 📄 License

This project is open source. Use it freely for personal and educational purposes.