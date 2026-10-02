import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = process.env.OPENAI_STT_MODEL || "gpt-transcribe";

const TRANSCRIPTION_PROMPT = `
Bu kayıt HDI Sigorta müşteri hizmetleri ve hasar dosya bilgi görüşmesidir.
Konuşma dili Türkçedir.

Aşağıdaki sigortacılık terimlerini özellikle doğru algıla:
HDI Sigorta
HDI Plus
hasar
hasar dosyası
dosya numarası
poliçe
poliçe numarası
TCKN
T.C. kimlik numarası
VKN
vergi kimlik numarası
partaj
acente
mağdur
servis
eksper
evrak
ödeme
IBAN
plaka
trafik
kasko

Plaka, dosya numarası, poliçe numarası, TCKN, VKN ve partaj gibi
kimlikleyici alanlarda duyduğun karakterleri uydurma.

Kullanıcı sayıları rakam rakam söylüyorsa rakam olarak yaz.

Plaka söyleniyorsa:
il kodu + harf grubu + rakam grubu
şeklini koru.

Örnek:
"on altı ce a fe iki yüz yetmiş üç"
=> "16 CAF 273"

Türkçe konuşmayı doğal biçimde yazıya çevir.
`.trim();

const KEYWORDS = [
  "HDI Sigorta",
  "HDI Plus",
  "hasar dosyası",
  "dosya numarası",
  "poliçe numarası",
  "TCKN",
  "T.C. kimlik numarası",
  "VKN",
  "vergi kimlik numarası",
  "partaj",
  "acente",
  "mağdur",
  "servis",
  "eksper",
  "evrak",
  "ödeme",
  "IBAN",
  "plaka",
  "trafik",
  "kasko"
];

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY tanımlı değil." },
        { status: 500 }
      );
    }

    const form = await request.formData();
    const audio = form.get("audio");

    if (!(audio instanceof File)) {
      return Response.json(
        { error: "Ses dosyası bulunamadı." },
        { status: 400 }
      );
    }

    if (audio.size > 25 * 1024 * 1024) {
      return Response.json(
        { error: "Ses kaydı 25 MB sınırını aşıyor." },
        { status: 413 }
      );
    }

    const transcriptionRequest = {
      model: MODEL,
      file: audio,
      prompt: TRANSCRIPTION_PROMPT
    };

    const transcription =
      await client.audio.transcriptions.create(
        transcriptionRequest,
        {
          body: {
            ...transcriptionRequest,
            keywords: KEYWORDS,
            languages: ["tr"]
          }
        }
      );

    return Response.json({
      text: String(transcription.text || "").trim(),
      model: MODEL
    });

  } catch (error) {
    console.error("voice/transcribe", error);

    return Response.json(
      {
        error: "Ses yazıya çevrilirken bir hata oluştu.",
        detail:
          process.env.NODE_ENV === "development"
            ? error?.message
            : undefined
      },
      { status: 500 }
    );
  }
}
