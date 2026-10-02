import OpenAI from "openai";

import {
  applyV6Turn,
  blankSession
} from "../../../lib/v6Engine";

import {
  validateTask
} from "../../../lib/taxonomy";

import {
  OPENING_INSTRUCTIONS,
  PLANNER_INSTRUCTIONS,
  RESPONSE_INSTRUCTIONS
} from "../../../lib/prompts";


export const runtime =
  "nodejs";


const client =
  new OpenAI({
    apiKey:
      process.env
        .OPENAI_API_KEY
  });


/*
 * Güncel flagship backend brain.
 */
const MODEL =
  process.env
    .OPENAI_MODEL ||
  "gpt-5.6-sol";


function safeJson(
  text
) {
  try {
    return JSON.parse(
      String(
        text || ""
      )
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
    .slice(-24)
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


function fallbackPlan(
  latest
) {
  const text =
    String(
      latest || ""
    ).toLocaleLowerCase(
      "tr-TR"
    );

  const roleCandidate =
    /\bsigortal[ıi]y[ıi]m\b/
      .test(text)
      ? "sigortali"

    : /\bma[gğ]durum\b/
      .test(text)
      ? "magdur"

    : /\bacenteyim\b|\bacente\b/
      .test(text)
      ? "acente"

    : /\bservisim\b|\bservisten\b/
      .test(text)
      ? "servis"

    : /\beksperim\b|\beksper\b/
      .test(text)
      ? "eksper"

    : /\bavukat[ıi]m\b/
      .test(text)
      ? "avukat"

    : /\bfirma yetkilisiyim\b/
      .test(text)
      ? "firma_yetkilisi"

    : null;


  return {
    dialogueAct:
      roleCandidate
        ? "provide_info"
        : "other",

    intents:
      /(dosya|hasar)/
        .test(text)
        ? ["claim_status"]
        : ["general"],

    roleCandidate,

    provided:
      {},

    providedCandidates:
      {},

    correction: {
      field: null,
      newValue: null,
      newValues: []
    },

    unavailableFields:
      [],

    claimReference: {
      claimNo: null,
      plate: null,
      dateText: null,
      ordinal: null,
      description: null,
      switchClaim: false
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
        "Genel bilgi"
    }
  };
}


async function generateOpening(
  clientContext = {}
) {
  const response =
    await client
      .responses
      .create({
        model:
          MODEL,

        reasoning: {
          effort:
            "low"
        },

        instructions:
          OPENING_INSTRUCTIONS,

        input:
          `LOCAL_CONTEXT:\n${JSON.stringify(
            clientContext,
            null,
            2
          )}`
      });

  return response
    .output_text
    .trim();
}


async function planConversation({
  messages,
  session,
  clientContext
}) {
  const latest =
    messages
      .at(-1)
      ?.content ||
    "";

  /*
   * Voice için latency önceliği:
   * low reasoning.
   *
   * Chat'te medium.
   */
  const voice =
    clientContext
      ?.channel ===
    "voice";

  const response =
    await client
      .responses
      .create({
        model:
          MODEL,

        reasoning: {
          effort:
            voice
              ? "low"
              : "medium"
        },

        instructions:
          PLANNER_INSTRUCTIONS,

        input:
          `LOCAL_CONTEXT:\n${JSON.stringify(
            clientContext || {},
            null,
            2
          )}

CURRENT_SESSION:
${JSON.stringify(
  session || {},
  null,
  2
)}

CONVERSATION:
${historyText(
  messages
)}`
      });

  const parsed =
    safeJson(
      response.output_text
    ) ||
    fallbackPlan(
      latest
    );


  parsed.task =
    validateTask(
      parsed.task ||
      {}
    );


  parsed.intents =
    Array.isArray(
      parsed.intents
    )
      ? parsed.intents
      : ["general"];


  parsed.provided =
    parsed.provided ||
    {};


  parsed.providedCandidates =
    parsed
      .providedCandidates ||
    {};


  parsed.correction =
    parsed.correction ||
    {
      field: null,
      newValue: null,
      newValues: []
    };


  parsed.unavailableFields =
    Array.isArray(
      parsed
        .unavailableFields
    )
      ? parsed
          .unavailableFields
      : [];


  parsed.claimReference =
    parsed
      .claimReference ||
    {};


  return parsed;
}


async function generateResponse({
  messages,
  plan,
  engine,
  clientContext
}) {
  const voice =
    clientContext
      ?.channel ===
    "voice";


  const response =
    await client
      .responses
      .create({
        model:
          MODEL,

        reasoning: {
          effort:
            voice
              ? "low"
              : "medium"
        },

        instructions:
          RESPONSE_INSTRUCTIONS,

        input:
          `LOCAL_CONTEXT:
${JSON.stringify(
  clientContext || {},
  null,
  2
)}

CONVERSATION:
${historyText(
  messages
)}

PLAN:
${JSON.stringify(
  plan,
  null,
  2
)}

SESSION:
${JSON.stringify(
  engine.session,
  null,
  2
)}

TOOL_CONTEXT:
${JSON.stringify(
  engine.toolContext,
  null,
  2
)}

UI_CONTEXT:
${JSON.stringify(
  engine.ui,
  null,
  2
)}

Yalnızca doğrulanmış tool sonuçları ve güvenlik çerçevesi içinde cevap üret.`
      });


  return response
    .output_text
    .trim();
}


export async function POST(
  request
) {
  try {
    if (
      !process.env
        .OPENAI_API_KEY
    ) {
      return Response.json(
        {
          error:
            "OPENAI_API_KEY tanımlı değil."
        },
        {
          status: 500
        }
      );
    }


    const body =
      await request.json();


    const clientContext =
      body.clientContext ||
      {};


    /*
     * İlk karşılama.
     */
    if (
      body.bootstrap
    ) {
      const message =
        await generateOpening(
          clientContext
        );


      return Response.json({
        message,

        session:
          blankSession(),

        quickActions:
          [],

        ui: {
          quickActions:
            [],

          claimCards:
            [],

          documentCards:
            []
        },

        model:
          MODEL,

        bootstrap:
          true
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


    if (
      !messages.length
    ) {
      return Response.json(
        {
          error:
            "Mesaj bulunamadı."
        },
        {
          status: 400
        }
      );
    }


    const latestUserText =
      messages
        .at(-1)
        ?.content ||
      "";


    /*
     * AI dialogue understanding.
     */
    const plan =
      await planConversation({
        messages,

        session:
          currentSession,

        clientContext
      });


    /*
     * Deterministic truth layer.
     */
    const engine =
      applyV6Turn({
        plan,

        currentSession,

        latestUserText,

        uploadedFiles:
          Array.isArray(
            body
              .uploadedFiles
          )
            ? body
                .uploadedFiles
            : []
      });


    /*
     * AI natural response.
     */
    const message =
      await generateResponse({
        messages,
        plan,
        engine,
        clientContext
      });


    return Response.json({
      message,

      quickActions:
        engine.ui
          ?.quickActions ||
        [],

      /*
       * V6 UI artık sadece
       * quickActions değil,
       * rich UI state alıyor.
       */
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
        MODEL
    });

  } catch (
    error
  ) {
    console.error(
      error
    );

    return Response.json(
      {
        error:
          "AI agent akışında beklenmeyen bir hata oluştu."
      },
      {
        status: 500
      }
    );
  }
}
