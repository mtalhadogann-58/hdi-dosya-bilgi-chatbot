import OpenAI from "openai";
import { applyPlan, blankSession } from "../../../lib/stateEngine";
import { validateTask } from "../../../lib/taxonomy";
import { PLANNER_INSTRUCTIONS, RESPONSE_INSTRUCTIONS } from "../../../lib/prompts";
import { VERIFICATION_POLICIES } from "../../../lib/policy";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

function safeJson(text) {
  try {
    return JSON.parse(
      String(text || "")
        .replace(/^```json\s*/i, "")
        .replace(/```$/i, "")
        .trim()
    );
  } catch {
    return null;
  }
}

function historyText(messages = []) {
  return messages.slice(-16).map((m) =>
    `${m.role === "assistant" ? "ASİSTAN" : "MÜŞTERİ"}: ${m.content}`
  ).join("\n");
}

function fallbackPlan(latest) {
  const t = String(latest || "").toLocaleLowerCase("tr-TR");
  const roleCandidate =
    /\bsigortal[ıi]y[ıi]m\b/.test(t) ? "sigortali" :
    /\bma[gğ]durum\b/.test(t) ? "magdur" :
    /\bacenteyim\b/.test(t) ? "acente" :
    /\bservisim\b|\bservisten\b/.test(t) ? "servis" :
    /\bavukat[ıi]m\b/.test(t) ? "avukat" :
    /\bfirma yetkilisiyim\b/.test(t) ? "firma_yetkilisi" : null;

  return {
    dialogueAct: roleCandidate ? "provide_info" : "other",
    intents: /(dosya|hasar)/.test(t) ? ["claim_status"] : ["general"],
    roleCandidate,
    provided: {},
    correction: { field: null, newValue: null },
    task: {
      kayitTuru: "Bilgi Talebi", anaKategori: "Genel",
      altKategori: "Diğer", altAltKategori: "Diğer",
      brans: "Bilinmiyor", konu: "Genel bilgi"
    }
  };
}

async function planConversation({ messages, session }) {
  const latest = messages.at(-1)?.content || "";
  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: "low" },
    instructions: PLANNER_INSTRUCTIONS,
    input: `CURRENT_SESSION:\n${JSON.stringify(session || {}, null, 2)}\n\nCONVERSATION:\n${historyText(messages)}`
  });

  const parsed = safeJson(response.output_text) || fallbackPlan(latest);
  parsed.task = validateTask(parsed.task || {});
  parsed.intents = Array.isArray(parsed.intents) ? parsed.intents : ["general"];
  parsed.provided = parsed.provided || {};
  parsed.correction = parsed.correction || { field: null, newValue: null };

  if (parsed.correction?.field && parsed.correction?.newValue && !parsed.provided[parsed.correction.field]) {
    parsed.provided[parsed.correction.field] = parsed.correction.newValue;
  }

  return parsed;
}

async function generateResponse({ messages, plan, engine }) {
  const policyState = engine.session.role
    ? VERIFICATION_POLICIES[engine.session.role] || null
    : null;

  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: "low" },
    instructions: RESPONSE_INSTRUCTIONS,
    input: `
CONVERSATION:
${historyText(messages)}

PLAN:
${JSON.stringify(plan, null, 2)}

SESSION:
${JSON.stringify(engine.session, null, 2)}

POLICY_STATE:
${JSON.stringify({
  verificationPolicy: policyState,
  next: engine.verificationNext || null
}, null, 2)}

TOOL_CONTEXT:
${JSON.stringify(engine.toolContext, null, 2)}

Görevin: Yukarıdaki doğrulanmış sonuçlara göre kullanıcıya doğal yanıt ver.
`
  });

  return response.output_text.trim();
}

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY tanımlı değil." }, { status: 500 });
    }

    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const currentSession = body.session && typeof body.session === "object"
      ? body.session
      : blankSession();

    if (!messages.length) {
      return Response.json({ error: "Mesaj bulunamadı." }, { status: 400 });
    }

    const plan = await planConversation({ messages, session: currentSession });
    const engine = applyPlan({ plan, currentSession });
    const message = await generateResponse({ messages, plan, engine });

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
    return Response.json(
      { error: "AI agent akışında beklenmeyen bir hata oluştu." },
      { status: 500 }
    );
  }
}
