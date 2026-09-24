import { afterEach, describe, expect, it } from "vitest";
import WebSocket, { WebSocketServer } from "ws";
import type { AddressInfo } from "node:net";
import { BrowserChannel } from "./channels";

let wss: WebSocketServer | null = null;
afterEach(() => new Promise<void>((r) => (wss ? wss.close(() => r()) : r())));

async function connect() {
  wss = new WebSocketServer({ port: 0 });
  const serverSide = new Promise<WebSocket>((r) => wss!.on("connection", r));
  const client = new WebSocket(`ws://127.0.0.1:${(wss.address() as AddressInfo).port}`);
  await new Promise((r) => client.on("open", r));
  return { client, channel: new BrowserChannel(await serverSide) };
}

describe("BrowserChannel", () => {
  it("closes the vendor socket after a vendor-initiated hangup", async () => {
    const { client, channel } = await connect();
    const reasons: string[] = [];
    channel.onHangup((r) => {
      reasons.push(r);
      channel.hangup("vendor_hangup"); // what RunController does when the agent ends
    });
    const closed = new Promise<number>((r) => client.on("close", r));
    client.send(JSON.stringify({ type: "hangup" }));
    expect(await closed).toBe(1000);
    expect(reasons).toEqual(["vendor_hangup"]);
  });

  it("forwards vendor audio and never sends transcripts", async () => {
    const { client, channel } = await connect();
    const audio = new Promise<string>((r) => channel.onAudio(r));
    client.send(JSON.stringify({ type: "audio", data: "AAAA" }));
    expect(await audio).toBe("AAAA");
    const got: string[] = [];
    client.on("message", (m) => got.push(JSON.parse(String(m)).type));
    channel.sendAudio("BBBB");
    channel.flush();
    channel.setState("live");
    await new Promise((r) => setTimeout(r, 50));
    expect(got).toEqual(["audio", "flush", "state"]);
    client.terminate();
  });
});
