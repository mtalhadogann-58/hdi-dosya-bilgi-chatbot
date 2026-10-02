import OpenAI from "openai";

import {
  applyV6Turn,
  blankSession,
} from "../../../lib/v6Engine";

import {
  validateTask,
} from "../../../lib/taxonomy";

import {
  PLANNER_INSTRUCTIONS,
  RESPONSE_INSTRUCTIONS,
} from "../../../lib/prompts";

export const runtime = "nodejs";

const client =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });

const MODEL =
  process.env.OPENAI_MODEL ||
  "gpt-5.6-sol";

const SERVICE_TIER =
  process.env.OPENAI_SERVICE_TIER ||
  "fast";

function safeJson(text) {
  try {
    return JSON.parse(
      String(text || "")
        .replace(
          /^```json\s*/i,
          ""
        )
        .replace(
          /```$/i,
          ""
        )
        .trim()
    );
  } catch {
    return null;
  }
}

function historyText(
  messages = []
) {
  return messages
    .slice(-12)
    .map(
      (message) =>
        `${
          message.role ===
          "assistant"
            ? "ASİSTAN"
            : "MÜŞTERİ"
        }: ${message.content}`
    )
    .join("\n");
}

function generateOpening(
  clientContext = {}
) {
  const hour =
    Number(
      clientContext.localHour
    );

  const salutation =
    Number.isFinite(hour)
      ? hour < 11
        ? "Günaydın"
        : hour < 18
        ? "İyi günler"
        : "İyi akşamlar"
      : "Merhaba";

  return `${salutation}, HDI Sigorta'dan Talha ben. Nasıl yardımcı olabilirim?`;
}

function fallbackPlan(
  latest
) {
  const text =
    String(latest || "")
      .toLocaleLowerCase(
        "tr-TR"
      );

  const roleCandidate =
    /\bsigortal[ıi]y[ıi]m\b/.test(
      text
    )
      ? "sigortali"
      : /\bma[gğ]durum\b/.test(
          text
        )
      ? "magdur"
      : /\bacenteyim\b|\bacente\b/.test(
          text
        )
      ? "acente"
      : /\bservisim\b|\bservisten\b/.test(
          text
        )
      ? "servis"
      : /\beksperim\b|\beksper\b/.test(
          text
        )
      ? "eksper"
      : /\bavukat[ıi]m\b/.test(
          text
        )
      ? "avukat"
      : /\bfirma yetkilisiyim\b/.test(
          text
        )
      ? "firma_yetkilisi"
      : null;

  return {
    dialogueAct:
      roleCandidate
        ? "provide_info"
        : "other",

    intents:
      /(dosya|hasar)/.test(
        text
      )
        ? ["claim_status"]
        : ["general"],

    roleCandidate,

    provided: {},

    providedCandidates: {},

    correction: {
      field: null,
      newValue: null,
      newValues: [],
    },

    unavailableFields: [],

    claimReference: {
      claimNo: null,
      plate: null,
      dateText: null,
      ordinal: null,
      description: null,
      switchClaim: false,
    },

    userSignal:
      "neutral",

    needsExplanation:
      false,

    task: {
      kayitTuru:
        "Bilgi Talebi",

      anaKategori:
        "Genel",

      altKategori:
        "Diğer",

      altAltKategori:
        "Diğer",

      brans:
        "Bilinmiyor",

      konu:
        "Genel bilgi",
    },
  };
}

async function planConversation({
  messages,
  session,
  clientContext,
}) {
  const latest =
    messages.at(-1)?.content ||
    "";

  const response =
    await client.responses.create({
      model: MODEL,

      service_tier:
        SERVICE_TIER,

      reasoning: {
        effort: "none",
      },

      max_output_tokens: 650,

      instructions:
        PLANNER_INSTRUCTIONS,

      input: `
LOCAL_CONTEXT:
${JSON.stringify(
  clientContext || {}
)}

CURRENT_SESSION:
${JSON.stringify(
  session || {}
)}

CONVERSATION:
${historyText(messages)}
`.trim(),
    });

  const parsed =
    safeJson(
      response.output_text
    ) ||
    fallbackPlan(latest);

  parsed.task =
    validateTask(
      parsed.task || {}
    );

  parsed.intents =
    Array.isArray(
      parsed.intents
    )
      ? parsed.intents
      : ["general"];

  parsed.provided =
    parsed.provided || {};

  parsed.providedCandidates =
    parsed.providedCandidates ||
    {};

  parsed.correction =
    parsed.correction || {
      field: null,
      newValue: null,
      newValues: [],
    };

  parsed.unavailableFields =
    Array.isArray(
      parsed.unavailableFields
    )
      ? parsed.unavailableFields
      : [];

  parsed.claimReference =
    parsed.claimReference ||
    {};

  return {
    plan: parsed,

    serviceTier:
      response.service_tier ||
      SERVICE_TIER,
  };
}

async function generateResponse({
  messages,
  plan,
  engine,
  clientContext,
}) {
  const voice =
    clientContext?.channel ===
    "voice";

  const response =
    await client.responses.create({
      model: MODEL,

      service_tier:
        SERVICE_TIER,

      reasoning: {
        effort: "none",
      },

      max_output_tokens:
        voice ? 180 : 420,

      instructions:
        RESPONSE_INSTRUCTIONS,

      input: `
LOCAL_CONTEXT:
${JSON.stringify(
  clientContext || {}
)}

CONVERSATION:
${historyText(messages)}

PLAN:
${JSON.stringify(plan)}

SESSION:
${JSON.stringify(
  engine.session
)}

TOOL_CONTEXT:
${JSON.stringify(
  engine.toolContext
)}

UI_CONTEXT:
${JSON.stringify(
  engine.ui
)}

Yalnızca doğrulanmış tool sonuçları ve güvenlik çerçevesi içinde cevap üret.
`.trim(),
    });

  return {
    text:
      response.output_text.trim(),

    serviceTier:
      response.service_tier ||
      SERVICE_TIER,
  };
}

export async function POST(
  request
) {
  try {
    if (
      !process.env.OPENAI_API_KEY
    ) {
      return Response.json(
        {
          error:
            "OPENAI_API_KEY tanımlı değil.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      await request.json();

    const clientContext =
      body.clientContext || {};

    /*
     * İlk karşılama artık AI request yapmıyor.
     * Anında oluşturuluyor.
     */
    if (body.bootstrap) {
      return Response.json({
        message:
          generateOpening(
            clientContext
          ),

        session:
          blankSession(),

        quickActions: [],

        ui: {
          quickActions: [],
          claimCards: [],
          documentCards: [],
          verification: null,
          uploadedFiles: [],
        },

        model: MODEL,

        serviceTier:
          SERVICE_TIER,

        bootstrap: true,
      });
    }

    const messages =
      Array.isArray(
        body.messages
      )
        ? body.messages
        : [];

    const currentSession =
      body.session &&
      typeof body.session ===
        "object"
        ? body.session
        : blankSession();

    if (!messages.length) {
      return Response.json(
        {
          error:
            "Mesaj bulunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    const latestUserText =
      messages.at(-1)
        ?.content || "";

    /*
     * AI dialogue understanding
     */
    const planner =
      await planConversation({
        messages,
        session:
          currentSession,
        clientContext,
      });

    const plan =
      planner.plan;

    /*
     * Deterministic HDI truth layer
     */
    const engine =
      applyV6Turn({
        plan,

        currentSession,

        latestUserText,

        uploadedFiles:
          Array.isArray(
            body.uploadedFiles
          )
            ? body.uploadedFiles
            : [],
      });

    /*
     * Natural language answer
     */
    const generated =
      await generateResponse({
        messages,
        plan,
        engine,
        clientContext,
      });

    return Response.json({
      message:
        generated.text,

      quickActions:
        engine.ui
          ?.quickActions ||
        [],

      ui:
        engine.ui,

      session:
        engine.session,

      plan,

      task:
        plan.task,

      toolTrace:
        engine.toolTrace,

      model:
        MODEL,

      serviceTier:
        generated.serviceTier ||
        planner.serviceTier,
    });
  } catch (error) {
    console.error(
      "AI agent:",
      error
    );

    return Response.json(
      {
        error:
          "AI agent akışında beklenmeyen bir hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}
