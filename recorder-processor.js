
class RecorderProcessor extends AudioWorkletProcessor {
constructor() {
super();
this.bufferSize = 4096;
this._buffer = new Float32Array(this.bufferSize);
this._bytesWritten = 0;
}

process(inputs, outputs, parameters) {
const input = inputs[0];
// input is array of channels, input[0] is Float32Array of samples
if (input && input.length > 0) {
const channelData = input[0];

  for (let i = 0; i < channelData.length; i++) {
    this._buffer[this._bytesWritten++] = channelData[i];

    if (this._bytesWritten >= this.bufferSize) {
      // Send a copy of the buffer to the main thread
      this.port.postMessage(this._buffer.slice(0, this.bufferSize));
      this._bytesWritten = 0;
    }
  }
}
return true; // Keep processor alive

}
}

registerProcessor('recorder-processor', RecorderProcessor);

