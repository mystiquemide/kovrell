// Captures mic audio at the device rate, resamples to 24 kHz mono PCM16, and posts ~50 ms frames.
const TARGET_RATE = 24000;
const FRAME_SAMPLES = 1200; // 50 ms at 24 kHz

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE;
    this.pos = 0; // fractional read position into the source stream
    this.prev = 0; // last source sample from the previous block, for interpolation
    this.out = new Int16Array(FRAME_SAMPLES);
    this.outLen = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    // Linear interpolation over [prev, ...input].
    while (this.pos < input.length) {
      const i = Math.floor(this.pos);
      const frac = this.pos - i;
      const a = i === 0 ? this.prev : input[i - 1];
      const b = input[i];
      const s = Math.max(-1, Math.min(1, a + (b - a) * frac));
      this.out[this.outLen++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.outLen === FRAME_SAMPLES) {
        this.port.postMessage(this.out.buffer.slice(0));
        this.outLen = 0;
      }
      this.pos += this.ratio;
    }
    this.pos -= input.length;
    this.prev = input[input.length - 1];
    return true;
  }
}

registerProcessor("capture-processor", CaptureProcessor);
