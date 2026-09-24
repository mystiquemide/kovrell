// Audio level metering for the live waveform and the stored run waveform. Real signal only.

function decodeMuLaw(byte: number): number {
  const u = ~byte & 0xff;
  const sign = u & 0x80 ? -1 : 1;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  return (sign * (((mantissa << 3) + 0x84) << exponent) - sign * 0x84) / 32768;
}

/** RMS of a base64 audio chunk, 0 to 1. */
export function rms(b64: string, encoding: "audio/pcm" | "audio/pcmu"): number {
  const buf = Buffer.from(b64, "base64");
  let sum = 0;
  let n = 0;
  if (encoding === "audio/pcmu") {
    for (const byte of buf) {
      const s = decodeMuLaw(byte);
      sum += s * s;
      n++;
    }
  } else {
    for (let i = 0; i + 1 < buf.length; i += 2) {
      const s = buf.readInt16LE(i) / 32768;
      sum += s * s;
      n++;
    }
  }
  return n ? Math.min(1, Math.sqrt(sum / n) * 3) : 0; // x3 so normal speech fills the bar range
}

/** Keeps the loudest agent and vendor level per tick, and the full per-tick series for the record. */
export class LevelMeter {
  private agent = 0;
  private vendor = 0;
  readonly series: number[] = [];

  addAgent(level: number) {
    this.agent = Math.max(this.agent, level);
  }

  addVendor(level: number) {
    this.vendor = Math.max(this.vendor, level);
  }

  /** Returns this tick's levels and resets for the next one. */
  tick(): { agent: number; vendor: number } {
    const out = { agent: Math.round(this.agent * 1000) / 1000, vendor: Math.round(this.vendor * 1000) / 1000 };
    this.series.push(Math.max(out.agent, out.vendor));
    this.agent = 0;
    this.vendor = 0;
    return out;
  }
}
