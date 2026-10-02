import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL =
  process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";

const VOICE =
  process.env.OPENAI_TTS_VOICE || "coral";

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY tanımlı değil." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const text = String(body?.text || "").trim();

    if (!text) {
      return Response.json(
        { error: "Seslendirilecek metin bulunamadı." },
        { status: 400 }
      );
    }

    if (text.length > 4096) {
      return Response.json(
        { error: "Seslendirilecek metin çok uzun." },
        { status: 400 }
      );
    }

    const audio = await client.audio.speech.create({
      model: MODEL,
      voice: VOICE,
      input: text,

      instructions: `
Türkçe konuş.

HDI Sigorta'nın deneyimli bir müşteri temsilcisi gibi konuş.
Kurumsal fakat doğal ol.
Robotik ton kullanma.
Sakin, güven veren ve zeki bir ses tonu kullan.
Cümleleri konuşma diline uygun oku.
Gereksiz dramatik vurgu yapma.

Dosya numarası, poliçe numarası, TCKN, VKN, partaj ve plaka gibi
sayısal bilgileri anlaşılır ve tane tane söyle.

Yanıt soru içeriyorsa doğal biçimde soru tonlaması kullan.
`.trim(),

      response_format: "mp3"
    });

    const buffer = Buffer.from(
      await audio.arrayBuffer()
    );

    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {
    console.error("voice/speak", error);

    return Response.json(
      {
        error: "Ses oluşturulurken bir hata oluştu.",
        detail:
          process.env.NODE_ENV === "development"
            ? error?.message
            : undefined
      },
      { status: 500 }
    );
  }
}
