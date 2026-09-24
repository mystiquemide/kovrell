import type { RequestDetail } from "../store";
import type { Challenge } from "../verification/challenges";

export const AGENT_VOICE = "jane";

function spellDigits(digits: string): string {
  return digits.split("").join(" ");
}

export interface AgentConfigInput {
  company: string;
  detail: RequestDetail;
  challenges: Challenge[];
  inputEncoding: "audio/pcm" | "audio/pcmu";
  outputEncoding: "audio/pcm" | "audio/pcmu";
}

export function buildGreeting(company: string, detail: RequestDetail): string {
  const { vendor } = detail;
  return (
    `Hi, this is the automated payments assistant from ${company} accounts payable. ` +
    `This call is recorded. Is this ${vendor.contact_name} at ${vendor.name}?`
  );
}

export function buildSystemPrompt({ company, detail, challenges }: AgentConfigInput): string {
  const { vendor, request } = detail;
  const questions = challenges.map((c) => `- ${c.id}: "${c.prompt}"`).join("\n");
  return `You are Kovrell, an automated payment verification agent calling on behalf of ${company} accounts payable.
You are on a call with ${vendor.contact_name} at ${vendor.name}, the vendor's contact of record.
${company} received a request to change the bank account it pays ${vendor.name}. Your job is to collect answers. You never decide the outcome.

Sound like a friendly, relaxed colleague from accounts payable doing a routine check. Warm, not formal. Use contractions. Follow these steps in order. Ask one thing at a time. Keep every sentence short.

1. The greeting already asked who you are speaking with. Wait until the person clearly says who they are, or clearly confirms they are ${vendor.contact_name}. Then call confirm_identity. A greeting, a question, or small talk is not a confirmation: answer it briefly and ask again who you are speaking with. If they say they are someone else, call confirm_identity with the name they give.
2. Say: "Thanks. This is a quick routine check to make sure your payments go to the right place. We got a request to change the bank account we pay ${vendor.name}. Did your team ask for that change?" Call record_request_status with their answer. If they say no, thank them and go straight to step 5.
3. Say: "Great. I just have three quick questions from our records." Then ask each question below exactly as written, one at a time. After each answer, call check_challenge with the question_id and their answer word for word. If they don't know, use the answer "unknown".
${questions}
4. Say: "Last one. The request asks us to pay ${request.new_bank_name}, account ending ${spellDigits(request.new_account_last4)}. Is that right?" Call confirm_readback with their answer.
5. Call finish_verification without saying anything first. Then say its closing_line exactly, and nothing else.

Rules:
- Never say any amount, date, invoice total, or account number from our records. If asked, say you can't share records on this call.
- Never say whether an answer was right or wrong. Never give hints. Never ask a question twice.
- Never promise that the payment will be released or blocked.
- If they want a person, say accounts payable will follow up, then call finish_verification.
- If you reach voicemail or nobody answers, call finish_verification.`;
}

export function buildTools(challenges: Challenge[]) {
  return [
    {
      type: "function",
      name: "confirm_identity",
      description: "Record who answered the call. Call once, right after they answer the greeting.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Person's name as they said it. Example: Jide Okafor" },
          company: { type: "string", description: "Company name as they said it. Example: Northwind Steel" },
          confirmed_by_caller: {
            type: "boolean",
            description: "true only if the person said their name or clearly said yes to being this contact",
          },
        },
        required: ["name", "company", "confirmed_by_caller"],
      },
    },
    {
      type: "function",
      name: "record_request_status",
      description: "Record whether the vendor says their company requested the bank account change.",
      parameters: {
        type: "object",
        properties: {
          vendor_says_requested: { type: "boolean", description: "true if they confirm they requested it" },
          note: { type: "string", description: "Short summary of what they said" },
        },
        required: ["vendor_says_requested"],
      },
    },
    {
      type: "function",
      name: "check_challenge",
      description: "Record the vendor's answer to one security question. Call after every answer, once per question.",
      parameters: {
        type: "object",
        properties: {
          question_id: { type: "string", enum: challenges.map((c) => c.id), description: "Which question was answered" },
          answer: {
            type: "string",
            description: "The answer word for word, with numbers as digits. Examples: 96325.00, August 12, unknown",
          },
        },
        required: ["question_id", "answer"],
      },
    },
    {
      type: "function",
      name: "confirm_readback",
      description: "Record whether the vendor confirmed the new bank name and account ending you read back.",
      parameters: {
        type: "object",
        properties: { confirmed: { type: "boolean", description: "true if they said it is correct" } },
        required: ["confirmed"],
      },
    },
    {
      type: "function",
      name: "finish_verification",
      description: "End the verification. Call when every step is done, when they deny the request, or when they ask for a person.",
      parameters: { type: "object", properties: {} },
      // Stay quiet until the closing line arrives, so the call ends with exactly one goodbye.
      execution_mode: "hold",
    },
  ];
}

export function buildSessionUpdate(input: AgentConfigInput) {
  const { detail, challenges } = input;
  const invoiceNumbers = detail.invoices.map((i) => i.number);
  return {
    type: "session.update",
    session: {
      system_prompt: buildSystemPrompt(input),
      greeting: buildGreeting(input.company, detail),
      input: {
        format: { encoding: input.inputEncoding },
        transcription_mode: "max_accuracy",
        keyterms: [detail.vendor.name, detail.vendor.contact_name, detail.request.new_bank_name, ...invoiceNumbers],
      },
      output: { voice: AGENT_VOICE, format: { encoding: input.outputEncoding } },
      tools: buildTools(challenges),
    },
  };
}
