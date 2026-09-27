# Kovrell

Kovrell calls the vendor before you pay.

It's a voice agent that checks every vendor bank-detail change request with a phone-style callback before any money moves. It's built on the [AssemblyAI Voice Agent API](https://www.assemblyai.com/docs/voice-agents/voice-agent-api).

**Live app:** https://kovrell.midelabs.xyz · **Recorded run:** [/evidence/run_acfbdd63](https://kovrell.midelabs.xyz/evidence/run_acfbdd63) · **API:** [/integrate](https://kovrell.midelabs.xyz/integrate)

## The problem

A fraudster emails accounts payable from a lookalike domain: "We changed banks, please pay the new account." AP is meant to call the vendor back on the number already on file. Most teams do, and it still fails.

- 74% of US organizations were hit by business email compromise in 2025, mostly vendor or executive impersonation ([AFP 2026, p. 6](https://www.truist.com/content/dam/truist-bank/us/en/documents/info/cci/2026-afp-payments-fraud-control-survey-report-key-highlights.pdf#page=6)).
- 94% call back on a number from official records, yet only 63% rate that control as very effective ([AFP 2026, p. 15](https://www.truist.com/content/dam/truist-bank/us/en/documents/info/cci/2026-afp-payments-fraud-control-survey-report-key-highlights.pdf#page=15)).
- Only 17% use AI against payments fraud ([AFP 2026 press release](https://www.financialprofessionals.org/about/learn-more/press-releases/Details/over-75-percent-of-us-firms-experienced-payments-fraud-in-2025-while-ai-adoption-for-fraud-mitigation-lags)).

Callbacks fail because they're manual and rushed. They get skipped under deadline pressure, the number gets pulled from the fraudulent email itself, and a friendly voice saying "yes, that's us" gets taken as proof. Nothing is left behind for the auditor.

## What Kovrell is

Kovrell isn't a chatbot, a fraud-scoring model, or a new inbox. It's a payment hold with a voice agent attached, and it runs on one rule: the model asks the questions, and code decides the verdict.

The agent calls only the contact of record, asks questions only the real vendor can answer from your own ledger, and never learns the answers. Deterministic server code compares what it heard against the ledger and then releases the payment, blocks it, or keeps it on hold. Every call is sealed into an evidence pack with the AssemblyAI recording and a sha256 hash.

## How it works

1. A bank-change request arrives and the payment is held.
2. A provenance preflight checks the vendor's number of record. If that number changed in the last 30 days, the call is locked and a person has to verify in person.
3. The agent calls the contact of record. It asks them to confirm identity, confirm they made the request, answer three ledger questions (two invoice totals and a payment date), and confirm a readback of the new account.
4. The server scores the answers and seals the evidence.

| Outcome | Rule | Payment |
|---|---|---|
| PASS | Identity confirmed, request confirmed, at least 2 of 3 ledger answers right, readback confirmed | Released to the new account |
| FAIL | Vendor denies the request, wrong person, 2+ wrong answers, or readback rejected | Blocked, account on file kept |
| INCONCLUSIVE | Hangup, timeout, provider error, or missing steps | Stays held, retry allowed |
| LOCKED | Number of record changed in the last 30 days | No call placed |

An answer of "I don't know" counts as wrong, and each question gets exactly one attempt.

## Try it in 3 minutes

The live app runs on a sample ledger with three vendors. You play the vendor with your own microphone.

1. Open [/requests](https://kovrell.midelabs.xyz/requests). Three payments are held. **Brightline Print** is locked because its phone number changed six days ago, so there's nothing to call.
2. Open **Northwind Steel** ($184,200.00) and press **Call vendor of record**.
3. On the call screen, press **Open vendor line** and allow the microphone. The call screen shows a tester sheet with what the real vendor knows: contact name, invoice totals, payment date, and new bank. The vendor line itself never shows it.
4. Try it two ways:
   - **Pass:** say you're Jide Okafor, confirm the request, answer from the sheet, and confirm the readback. The verdict is PASS, the payment is released to Chase ending 8841, and the transcript fills in live.
   - **Block:** say your team never asked for a change, or guess the invoice totals. The verdict is FAIL and the payment stays on the account on file.
5. Open [/evidence](https://kovrell.midelabs.xyz/evidence) to see the sealed record: the verdict, each check with what was heard, the AssemblyAI recording and timeline, and the sha256 seal with a one-line command to re-verify it.
6. When you're done, press **Reset the sample ledger** on /requests so the next person starts clean.

**No microphone?** Open [/evidence/run_acfbdd63](https://kovrell.midelabs.xyz/evidence/run_acfbdd63). It's a real recorded PASS run (about 100 s, 3 of 3 checks, 1.96 s median agent response time). The landing page plays the same call with checks lighting up in sync.

**API path:**

```bash
curl -X POST https://kovrell.midelabs.xyz/api/requests/req_halden/runs   # 201 with a vendor call link
curl -X POST https://kovrell.midelabs.xyz/api/requests/req_brightline/runs   # 423 locked by provenance
curl https://kovrell.midelabs.xyz/api/runs/<run id>                    # live checks and verdict
```

More request and evidence examples are on [/integrate](https://kovrell.midelabs.xyz/integrate).

## How it uses AssemblyAI

Kovrell uses the **Voice Agent API** end to end: speech-to-text, the LLM turn, voice output, turn-taking, and tool calls, all over one WebSocket.

| Feature | How Kovrell uses it |
|---|---|
| `session.update` per run | The system prompt, greeting, and tools are built for each request from the ledger ([config.ts](src/server/agent/config.ts)). The prompt carries the questions but never the answers. |
| JSON-Schema tool calling | Five tools: `confirm_identity`, `record_request_status`, `check_challenge`, `confirm_readback`, `finish_verification`. `question_id` is an enum built per run, so the model can't invent questions. |
| `execution_mode: "hold"` | `finish_verification` keeps the agent silent until the server returns a neutral closing line, so the call ends with one goodbye and the verdict is never spoken. |
| `transcription_mode: "max_accuracy"` + `keyterms` | Dollar amounts and dates matter more than 100 ms. Vendor names, contact names, bank names, and invoice numbers are passed as keyterms. |
| Barge-in | `reply.done` with `status: interrupted` flushes queued agent audio on the vendor side. |
| Session artifacts | After `session.ended`, the server fetches the stereo recording and timeline from `GET /v1/sessions/{id}` (with retry) and seals them into the evidence pack ([evidence.ts](src/server/evidence.ts)). |

The server holds the AssemblyAI socket, and the vendor's browser is only an audio pipe. The party being verified may be the fraudster, so a browser-side agent could rewrite the prompt with its own `session.update` or fake a tool result. Kovrell never issues a token to the browser and never sends it transcripts or tool results. See [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Ways I tried to break it

| Attack or failure | Outcome | Proof |
|---|---|---|
| Fraudster confirms the request but guesses the ledger answers | FAIL on 2+ wrong answers, payment blocked | [verification.test.ts#L143](src/server/verification/verification.test.ts#L143) |
| Real vendor says they never requested a change | FAIL, account on file kept | [verification.test.ts#L136](src/server/verification/verification.test.ts#L136), [runs.test.ts#L118](src/server/runs.test.ts#L118) |
| Wrong person picks up | FAIL | [verification.test.ts#L152](src/server/verification/verification.test.ts#L152) |
| "Hello, can you hear me?" treated as an identity confirmation (bug found in a human test) | Identity needs an explicit confirmation from the caller | [agent-session.test.ts#L93](src/server/agent/agent-session.test.ts#L93) |
| Vendor rejects the readback of the new account | FAIL | [verification.test.ts#L158](src/server/verification/verification.test.ts#L158) |
| Caller retries a question after a wrong answer | Only the first answer counts | [verification.test.ts#L181](src/server/verification/verification.test.ts#L181) |
| Fraudster changed the phone number of record first | LOCKED before any call | [verification.test.ts#L88](src/server/verification/verification.test.ts#L88), [runs.test.ts#L86](src/server/runs.test.ts#L86) |
| Call drops after good answers but before the end | Downgraded to INCONCLUSIVE, payment held | [agent-session.test.ts#L113](src/server/agent/agent-session.test.ts#L113) |
| AssemblyAI rejects or drops the session | Fails closed to INCONCLUSIVE | [agent-session.test.ts#L175](src/server/agent/agent-session.test.ts#L175) |
| Agent leaks ledger values in the prompt or questions | The session config and questions carry no ledger answers | [agent-session.test.ts#L52](src/server/agent/agent-session.test.ts#L52), [verification.test.ts#L97](src/server/verification/verification.test.ts#L97) |
| Vendor page tries to read answers, tokens, or transcripts | Views strip answers and tokens, and the vendor socket gets audio and call state only | [views.test.ts#L9](src/server/views.test.ts#L9), [views.test.ts#L20](src/server/views.test.ts#L20), [channels.test.ts#L31](src/server/channels.test.ts#L31) |
| Call link reused or opened late | Single use, 15 minute expiry | [runs.test.ts#L90](src/server/runs.test.ts#L90), [runs.test.ts#L98](src/server/runs.test.ts#L98) |

## Live proof

| Item | Value |
|---|---|
| App | https://kovrell.midelabs.xyz |
| Recorded PASS run | [run_acfbdd63](https://kovrell.midelabs.xyz/evidence/run_acfbdd63), AssemblyAI session `sess_76253d3c9c9e4f2288868d44c33ed8a9`, recorded 2026-09-24 |
| Evidence seal | `d17939c156d59c782fe722168837804fffcdae98df12b00a7b10052eba11ffcf` ([record](public/showcase/northwind-run.json)) |
| Recording | [northwind-verification.mp3](public/showcase/northwind-verification.mp3) |

In the showcase run, the vendor side is a scripted test caller, and the evidence page says so. Human browser calls were tested during the build, and both FAIL paths (a denied request and three "can't remember" answers) blocked correctly.

## How this differs

| Alternative | What it does | Why Kovrell is different |
|---|---|---|
| Manual callback by AP staff | A person dials the number on file | It gets skipped under pressure, depends on who picks up, and leaves no record. Kovrell makes the hold the default, asks ledger questions, and seals evidence. |
| Vendor-management portals and bank-account validation | Check that an account exists and who owns it | They check the account, not whether the vendor asked for the change. Kovrell asks the vendor on a line the fraudster doesn't control. |
| Email security and BEC filters | Flag suspicious email | They act before the request reaches AP. Kovrell acts at the point of payment, whatever channel the request came in on. |
| Typical voice agent demo | An LLM chats and decides the outcome | Here the LLM decides nothing. It never sees the answers, can't say whether one was right, and can't pick the verdict. |

## Honest limitations

- This is hackathon code. It's unaudited and not production-ready for real payments.
- It runs on a sample ledger. There's no ERP or AP system integration yet, though `POST /api/requests` is the seam for one.
- Calls run in the browser. The phone channel (Twilio, `audio/pcmu`, which AssemblyAI accepts natively) is designed behind the `CallChannel` interface but not built.
- Ledger questions protect against outsiders, not insiders. A fraudster with access to the vendor's own invoices could pass.
- Voice cloning isn't detected. Kovrell relies on knowledge checks and the number of record, not voice biometrics.
- The live demo is a single instance with SQLite and a shared public ledger. Two people testing at once will see each other's runs.
- Each vendor turn takes about 2 s to get a response (1.96 s median in the showcase run), because accuracy mode is on.

## What's real

Every call, transcript, tool call, verdict, and evidence seal in the app comes from the AssemblyAI Voice Agent API and the Kovrell server. The ledger data is sample data. The model collects answers, and [deterministic code](src/server/verification/session.ts) decides PASS, FAIL, or INCONCLUSIVE. 72 tests pass (`npm test`), and `npm run typecheck` and `npm run lint` are clean.

## Run locally

Requirements: Node 22 and an AssemblyAI API key.

```bash
git clone https://github.com/mystiquemide/kovrell && cd kovrell
npm install
cp .env.example .env.local   # set ASSEMBLYAI_API_KEY
npm test
npm run dev                  # http://localhost:3000
```

Stack: Next.js 16, React 19, TypeScript, Tailwind v4, `ws`, SQLite (`better-sqlite3`), Vitest. One Node process serves the app and the WebSockets.

Photos from Unsplash under the Unsplash License: forest in motion by Beau Carpenter, warm blur by Liana S.
