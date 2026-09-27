# Kovrell Architecture

## 1. Shape

One Node service: Next.js (App Router) behind a custom `server.ts` that also hosts WebSocket endpoints. The server owns every AssemblyAI Voice Agent API connection. Browsers never talk to AssemblyAI directly.

```
 Vendor browser (/v/[token])            AP dashboard (/calls/[id])
   mic PCM16 24k  |  agent audio            | run events (read only)
        ws /ws/vendor/:token                ws /ws/watch/:runId
                \                            /
             +-------------------------------------+
             |  Kovrell server (Node, server.ts)   |
             |  CallChannel -> RunController       |
             |  VerificationEngine (tools+verdict) |
             |  EventBus -> run_events (SQLite)    |
             +-------------------------------------+
                        | wss://agents.assemblyai.com/v1/ws
                        | (Authorization: Bearer API key)
                AssemblyAI Voice Agent API
                        | after session.ended
                GET /v1/sessions/{id} -> audio, timeline, metadata
```

## 2. Why the server holds the agent session

AssemblyAI's browser integration lets the browser connect with a temporary token and run client-side tools itself. Kovrell cannot use that, because the browser belongs to the party being verified, who may be the fraudster. If the vendor's browser held the socket it could:

- rewrite the system prompt or tools with its own `session.update`,
- see tool calls and results,
- fake tool results and push a PASS.

So the server opens the socket with the API key, sends `session.update`, runs every tool, and computes the verdict. The vendor browser is only an audio pipe. This is also exactly how the phone channel works, so both channels share one path.

Verified on 2026-09-24: server-side connect with `Authorization: Bearer`, `session.ready` in 316 ms, greeting spoken, audio events carry base64 in `data`, clean `session.end` then `session.ended`.

## 3. CallChannel

```ts
interface CallChannel {
  kind: "browser" | "phone";
  inputEncoding: "audio/pcm" | "audio/pcmu";   // what we send to AssemblyAI
  outputEncoding: "audio/pcm" | "audio/pcmu";
  onAudio(cb: (b64: string) => void): void;     // vendor speech, base64
  sendAudio(b64: string): void;                 // agent speech to vendor
  flush(): void;                                 // barge-in: drop queued agent audio
  onHangup(cb: (reason: string) => void): void;
  hangup(reason: string): void;
}
```

- `BrowserChannel`: vendor page captures mic in an AudioWorklet at the device rate, resamples to 24 kHz PCM16, sends ~50 ms frames. Plays agent audio through a separate playback queue. `echoCancellation: true`, `noiseSuppression: false`.
- `PhoneChannel` (Should tier): Twilio outbound call, `<Connect><Stream>` to `/ws/twilio/:runId`. Twilio sends 8 kHz mu-law, which AssemblyAI accepts natively as `audio/pcmu`. No transcoding.

## 4. Run lifecycle

```
request HELD
  -> preflight(provenance)            fail -> LOCKED (no call)
  -> run created, vendor call link issued to contact of record
  -> vendor answers -> AssemblyAI session.update -> session.ready
  -> agent: disclosure, identity, challenges, readback (tool calls)
  -> finish_verification tool or hangup
  -> VerificationEngine.verdict()      PASS | FAIL | INCONCLUSIVE
  -> payment status: VERIFIED | BLOCKED | HELD
  -> session.end -> fetch artifacts -> evidence pack sealed (sha256)
```

Fail closed: socket error, provider error, timeout (6 min max), vendor hangup before verdict, or missing artifacts never release a payment. They produce INCONCLUSIVE and the request stays HELD.

## 5. Agent configuration

Sent inline in `session.update` per run, built from the request:

- `greeting`: "Hi, this is the automated payments assistant from {company} accounts payable. This call is recorded. Is this {contact_name} at {vendor_name}?"
- `system_prompt`: role, strict script order, the challenge questions as text (never the answers), rules: never state amounts or dates from records, never say whether an answer was right, one attempt per question, stay neutral, end politely.
- `input.keyterms`: vendor name, contact name, invoice numbers, bank names.
- `input.transcription_mode`: `max_accuracy` (numbers matter more than 100 ms).
- `output.voice`: `jane`.
- `tools`: below, all `type: "function"`, run on the Kovrell server.

## 6. Tools

| Tool | Parameters | Server behavior | Returned to agent |
|---|---|---|---|
| `confirm_identity` | `name` string, `company` string, `confirmed_by_caller` boolean | Fuzzy match to contact of record, only counted when the caller explicitly confirmed | `{recorded:true}` plus next step |
| `record_request_status` | `vendor_says_requested` boolean, `note` string | If false, mark DENIAL | `{recorded:true}` |
| `check_challenge` | `question_id` enum, `answer` string | Parse amount or date, compare to ledger (amount within $1, exact date). First answer per question only. | `{recorded:true}` never correctness |
| `confirm_readback` | `confirmed` boolean | Agent read back "bank name, account ending ####" of the requested details. Store the vendor's yes or no. | `{recorded:true}` |
| `finish_verification` | none | Compute verdict, set payment status, schedule hangup after the closing line | `{closing_line}` neutral, no verdict |

`question_id` is an enum built per run (`q1`, `q2`, `q3`) so the model cannot invent questions. Tool results follow the doc rule: sent only when `reply.done` is the latest event, queued otherwise.

## 7. Verdict rules (deterministic, not the LLM)

- FAIL if vendor denied requesting the change.
- FAIL if identity mismatch.
- FAIL if 2 or more challenges wrong.
- FAIL if readback rejected.
- PASS if identity ok, at least 2 of 3 challenges correct, readback confirmed, no denial.
- INCONCLUSIVE otherwise (unanswered questions, hangup, error).

## 8. Provenance preflight

| Check | Pass condition |
|---|---|
| Number of record age | contact phone unchanged for 30+ days |
| Recent change | no phone or email change on the vendor in 30 days |
| Channel separation | request's callback contact differs from contact of record, and is never used |

Any failure locks the call with a reason. A person has to verify in person.

## 9. Data model (SQLite, better-sqlite3)

- `vendors(id, name, contact_name, contact_phone, contact_email, bank_name, account_last4, routing_last4)`
- `vendor_changes(id, vendor_id, field, old_value, new_value, changed_at, source)`
- `invoices(id, vendor_id, number, amount_cents, issued_on, paid_on)`
- `payments(id, vendor_id, amount_cents, due_on, status, destination_last4)`
- `requests(id, vendor_id, received_at, channel, new_bank_name, new_account_last4, callback_contact, status)`
- `runs(id, request_id, channel, call_token, token_expires_at, aai_session_id, status, verdict, reason, started_at, ended_at, evidence_sha256)`
- `run_events(id, run_id, t_ms, kind, payload_json)` kinds: `agent`, `vendor`, `tool`, `check`, `state`, `error`
- `checks(run_id, key, status, expected_redacted, heard)`

The sample ledger seeds on first boot (lazy `ensureSeed()` in the store module). The README labels it a sample ledger.

## 10. HTTP and WS API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/requests` | inbox |
| GET | `/api/requests/:id` | detail with provenance |
| POST | `/api/requests/:id/runs` | preflight, create run, return vendor call link |
| GET | `/api/runs/:id` | run state, checks, events |
| GET | `/api/runs/:id/evidence` | evidence JSON bundle |
| GET | `/api/runs/:id/audio` | fresh pre-signed recording URL (server-side key) |
| POST | `/api/requests` | create a bank change request (integration seam) |
| POST | `/api/reset` | reset sample ledger (protected by `ADMIN_TOKEN`) |
| WS | `/ws/vendor/:token` | vendor audio, single use, 15 min expiry |
| WS | `/ws/watch/:runId` | AP live events, read only |

## 11. Evidence pack

Sealed after `session.ended`:
- Kovrell event log (source of truth for checks and verdict).
- AssemblyAI `timeline` JSON and recording (stereo OGG, vendor left, agent right), fetched from `GET /v1/sessions/{id}` with retry, since artifacts appear only after completion.
- Provenance results, challenge table (expected shown redacted in the UI, full to auditors), verdict, reason.
- `sha256` of the canonical bundle stored on the run, shown on the page.

## 12. Security

- API key only on the server. No temporary tokens issued to browsers.
- Vendor call token: 32 random bytes, single use, 15 minute expiry, bound to one run.
- Agent never receives expected answers. Tool results never reveal correctness. One attempt per question.
- Watch socket is read only. No write path from any browser to the agent.
- `ADMIN_TOKEN` guards reset. Rate limit run creation.
- Secrets from env only, `.env.local` gitignored.

## 13. Stack

Node 22, Next.js 16, React 19, TypeScript, Tailwind v4, `ws`, `better-sqlite3`, `zod`, Vitest. Fonts Inter Tight and JetBrains Mono via `next/font/google`.

## 14. Deployment

Needs a long-lived Node process with WebSockets and HTTPS (mic access requires a secure origin), so serverless platforms do not fit. The live app runs as one instance (`npm start`) with SQLite on local disk, behind a Cloudflare tunnel at https://kovrell.midelabs.xyz.

## 15. Metrics

Per run: time to answer, call duration, tool call count, turns, verdict, time from request received to verdict. Dashboard counts: held, verified, blocked, inconclusive.
