import OpenAI from "openai";
import { applyPlan, blankSession } from "../../../lib/stateEngine";
import { validateTask } from "../../../lib/taxonomy";
import { OPENING_INSTRUCTIONS, PLANNER_INSTRUCTIONS, RESPONSE_INSTRUCTIONS } from "../../../lib/prompts";
import { VERIFICATION_POLICIES } from "../../../lib/policy";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-6-sol";

function safeJson(text) {
  try {
    return JSON.parse(String(text || "").replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
  } catch {
    return null;
  }
}

function historyText(messages = []) {
  return messages.slice(-20).map((m) => `${m.role === "assistant" ? "ASİSTAN" : "MÜŞTERİ"}: ${m.content}`).join("\n");
}

function fallbackPlan(latest) {
  const t = String(latest || "").toLocaleLowerCase("tr-TR");
  const roleCandidate =
    /\bsigortal[ıi]y[ıi]m\b/.test(t) ? "sigortali" :
    /\bma[gğ]durum\b/.test(t) ? "magdur" :
    /\bacenteyim\b|\bacente\b/.test(t) ? "acente" :
    /\bservisim\b|\bservisten\b/.test(t) ? "servis" :
    /\bavukat[ıi]m\b/.test(t) ? "avukat" :
    /\bfirma yetkilisiyim\b/.test(t) ? "firma_yetkilisi" : null;

  return {
    dialogueAct: roleCandidate ? "provide_info" : "other",
    intents: /(dosya|hasar)/.test(t) ? ["claim_status"] : ["general"],
    roleCandidate,
    provided: {},
    correction: { field: null, newValue: null },
    unavailableFields: [],
    claimReference: { claimNo: null, plate: null, dateText: null, ordinal: null, description: null, switchClaim: false },
    userSignal: "neutral",
    needsExplanation: false,
    task: { kayitTuru: "Bilgi Talebi", anaKategori: "Genel", altKategori: "Diğer", altAltKategori: "Diğer", brans: "Bilinmiyor", konu: "Genel bilgi" }
  };
}

async function generateOpening(clientContext = {}) {
  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: "low" },
    instructions: OPENING_INSTRUCTIONS,
    input: `LOCAL_CONTEXT:\n${JSON.stringify(clientContext, null, 2)}`
  });
  return response.output_text.trim();
}

async function planConversation({ messages, session, clientContext }) {
  const latest = messages.at(-1)?.content || "";
  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: "medium" },
    instructions: PLANNER_INSTRUCTIONS,
    input: `LOCAL_CONTEXT:\n${JSON.stringify(clientContext || {}, null, 2)}\n\nCURRENT_SESSION:\n${JSON.stringify(session || {}, null, 2)}\n\nCONVERSATION:\n${historyText(messages)}`
  });

  const parsed = safeJson(response.output_text) || fallbackPlan(latest);
  parsed.task = validateTask(parsed.task || {});
  parsed.intents = Array.isArray(parsed.intents) ? parsed.intents : ["general"];
  parsed.provided = parsed.provided || {};
  parsed.correction = parsed.correction || { field: null, newValue: null };
  parsed.unavailableFields = Array.isArray(parsed.unavailableFields) ? parsed.unavailableFields : [];
  parsed.claimReference = parsed.claimReference || { claimNo: null, plate: null, dateText: null, ordinal: null, description: null, switchClaim: false };
  return parsed;
}

async function generateResponse({ messages, plan, engine, clientContext }) {
  const policyState = engine.session.role ? VERIFICATION_POLICIES[engine.session.role] || null : null;
  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: "medium" },
    instructions: RESPONSE_INSTRUCTIONS,
    input: `LOCAL_CONTEXT:\n${JSON.stringify(clientContext || {}, null, 2)}\n\nCONVERSATION:\n${historyText(messages)}\n\nPLAN:\n${JSON.stringify(plan, null, 2)}\n\nSESSION:\n${JSON.stringify(engine.session, null, 2)}\n\nPOLICY_STATE:\n${JSON.stringify({ verificationPolicy: policyState, next: engine.verificationNext || null }, null, 2)}\n\nTOOL_CONTEXT:\n${JSON.stringify(engine.toolContext, null, 2)}\n\nYanıtını yalnızca doğrulanmış tool sonuçları ve güvenlik çerçevesi içinde üret.`
  });
  return response.output_text.trim();
}

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY tanımlı değil." }, { status: 500 });
    }

    const body = await request.json();
    const clientContext = body.clientContext || {};

    if (body.bootstrap) {
      const message = await generateOpening(clientContext);
      return Response.json({ message, session: blankSession(), quickActions: [], model: MODEL, bootstrap: true });
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const currentSession = body.session && typeof body.session === "object" ? body.session : blankSession();
    if (!messages.length) return Response.json({ error: "Mesaj bulunamadı." }, { status: 400 });

    // AI her turda devrede: hiçbir doğrulama aşamasında planner bypass edilmez.
    const plan = await planConversation({ messages, session: currentSession, clientContext });
    const engine = applyPlan({ plan, currentSession });
    const message = await generateResponse({ messages, plan, engine, clientContext });

    return Response.json({
      message,
      quickActions: engine.ui?.quickActions || [],
      session: engine.session,
      plan,
      task: plan.task,
      toolTrace: engine.toolTrace,
      model: MODEL
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "AI agent akışında beklenmeyen bir hata oluştu." }, { status: 500 });
  }
}
