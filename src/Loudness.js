import Sound from "./Sound.js";

// https://github.com/LLK/scratch-audio/blob/develop/src/Loudness.js

export default class LoudnessHandler {
  constructor() {
    this.mic = null;
    this.hasConnected = null;
  }

  get audioContext() {
    return Sound.audioContext;
  }

  connect() {
    if (this.hasConnected) return;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(stream => {
        this.hasConnected = true;
        this.audioStream = stream;
        this.mic = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.mic.connect(this.analyser);
        this.micDataArray = new Float32Array(this.analyser.fftSize);
      })
      .catch(() => {});
  }

  get loudness() {
    if (this.mic && this.audioStream.active) {
      this.analyser.getFloatTimeDomainData(this.micDataArray);
      let sum = 0;
      for (let i = 0; i < this.micDataArray.length; i++) {
        sum += Math.pow(this.micDataArray[i], 2);
      }
      let rms = Math.sqrt(sum / this.micDataArray.length);
      if (this._lastValue) {
        rms = Math.max(rms, this._lastValue * 0.6);
      }
      this._lastValue = rms;
      rms *= 1.63;
      rms = Math.sqrt(rms);
      rms = Math.round(rms * 100);
      rms = Math.min(rms, 100);
      return rms;
    }
    return -1;
  }

  getLoudness() {
    this.connect();
    return this.loudness;
  }
}
