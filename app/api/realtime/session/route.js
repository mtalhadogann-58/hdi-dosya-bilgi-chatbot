export const runtime = "nodejs";

const REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";

export async function POST() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY tanımlı değil." },
        { status: 500 }
      );
    }

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: REALTIME_MODEL,

            output_modalities: ["audio"],

            instructions: `
Sen TalhaGPT'nin yalnızca gerçek zamanlı SES KATMANISIN.

Talha erkek bir dijital asistandır.
Türkçe konuşursun.

Bu bir IVR anonsu değildir.
Bir müşteriyle telefonda birebir konuşuyormuş gibi seslendirirsin.

Konuşma karakterin:
- doğal
- hızlı ama anlaşılır
- sıcak fakat profesyonel
- kendinden emin
- insan temsilci temposunda
- gereksiz duraksamasız
- kelimeleri tek tek anons eder gibi okumayan
- cümle sonlarında yapay tonlama yapmayan

Kullanıcının iş sorularına kendi başına cevap VERME.
İş cevabı HDI'nin V5 agent katmanından gelecektir.

Uygulama sana bir metin verdiğinde:
- yeni bilgi ekleme,
- bilgi çıkarma,
- anlamı değiştirme,
- metni doğal bir telefon konuşması gibi seslendir.

Sayı, plaka, TCKN, VKN, dosya numarası,
poliçe numarası ve partaj gibi bilgileri anlaşılır söyle.
`.trim(),

            audio: {
              input: {
                transcription: {
                  model: "gpt-live-transcribe",

                  prompt:
                    "HDI Sigorta hasar müşteri hizmetleri telefon görüşmesi. " +
                    "Türkçe konuşma. Hasar, poliçe, dosya numarası, TCKN, VKN, " +
                    "partaj, acente, mağdur, servis, eksper, evrak, ödeme, IBAN, " +
                    "plaka, trafik, kasko ve HDI Plus terimleri geçebilir. " +
                    "Plaka ve sayısal kimlikleyicileri özellikle dikkatli yaz.",

                  keywords: [
                    "HDI Sigorta",
                    "HDI Plus",
                    "hasar",
                    "hasar dosyası",
                    "dosya numarası",
                    "poliçe",
                    "poliçe numarası",
                    "TCKN",
                    "VKN",
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
                  ],

                  languages: ["tr"],

                  // Transcript ekrana mümkün olduğunca erken aksın.
                  delay: "low"
                },

                noise_reduction: {
                  type: "near_field"
                },

                /*
                 * Kullanıcı konuşmayı bitirdiğinde
                 * otomatik olarak turn'ü commit eder.
                 *
                 * create_response FALSE:
                 * Realtime model iş cevabını üretmez.
                 * Cevabı V5 /api/chat üretecek.
                 */
                turn_detection: {
                  type: "semantic_vad",
                  eagerness: "high",
                  create_response: false,
                  interrupt_response: true
                }
              },

              output: {
                // Talha için ilk deneyeceğimiz daha maskülen preset.
                voice: "ash",

                // Önceki yavaş IVR hissini kırıyoruz.
                speed: 1.18
              }
            }
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Realtime client secret:", data);

      return Response.json(
        {
          error:
            data?.error?.message ||
            "Realtime oturumu oluşturulamadı."
        },
        { status: response.status }
      );
    }

    return Response.json(data);
  } catch (error) {
    console.error("Realtime session error:", error);

    return Response.json(
      {
        error: "VoiceBot oturumu oluşturulurken hata oluştu."
      },
      { status: 500 }
    );
  }
}
