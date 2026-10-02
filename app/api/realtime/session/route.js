export const runtime = "nodejs";

const REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL ||
  "gpt-realtime-2.1";

export async function POST() {
  try {
    if (!process.env.OPENAI_API_KEY) {
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

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          session: {
            type: "realtime",

            model: REALTIME_MODEL,

            output_modalities: [
              "audio",
            ],

            instructions: `
Sen HDI Sigorta AI Assistant Talha'nın ses katmanısın.

Talha genç yetişkin bir ERKEK dijital asistandır.

Türkçe konuşursun.

Bir IVR değilsin.
Bir çağrı merkezi anonsu değilsin.
Bir spiker gibi metin okumazsın.

Gerçek bir müşteri temsilcisi gibi:
- doğal,
- rahat,
- akıcı,
- sıcak,
- profesyonel,
- kendinden emin
konuşursun.

Normal insan konuşma hızından hafif hızlı konuş.

Gereksiz duraklama yapma.

Her kelimeyi ayrı ayrı vurgulama.

Cümle sonlarını yapay şekilde uzatma.

Kullanıcının jargonunu taklit etme.

ASLA şu hitapları kullanma:
abi
kanka
bro
reis
dostum
kardeşim

İş cevabını kendin üretme.

HDI backend agent'ın verdiği cevabı seslendir.

Verilen bilgiyi değiştirme.
Yeni bilgi ekleme.
Bilgi çıkarma.

Dosya numarası,
poliçe numarası,
TCKN,
VKN,
partaj,
servis kodu,
eksper kodu
ve plakaları dikkatli söyle.
`.trim(),

            audio: {
              input: {
                transcription: {
                  model:
                    "gpt-live-transcribe",

                  delay:
                    "medium",

                  languages: [
                    "tr",
                  ],

                  prompt: `
Bu HDI Sigorta müşteri hizmetleri ve hasar görüşmesidir.

Dil Türkçedir.

Konuşmayı yazıya aktarırken anlamı koru ve özellikle kimlikleyici alanlarda dikkatli ol.

Sık geçen kavramlar:

HDI Sigorta
HDI Plus
hasar
hasar dosyası
dosya numarası
poliçe
poliçe numarası
TCKN
TC kimlik numarası
VKN
vergi kimlik numarası
partaj
partaj kodu
acente
mağdur
servis
servis anlaşma kodu
eksper
eksper anlaşma kodu
evrak
ödeme
IBAN
plaka
trafik
kasko

Plaka örneği:

"on altı a de altı yüz otuz"
= "16 AD 630"

"on altı ce a fe iki yüz yetmiş üç"
= "16 CAF 273"

Birden fazla alternatif söyleniyorsa hiçbirini kaybetme.

Örnek:

"Plaka ya 16 CAF 273 ya da 34 S 2054"

Transcript:

"Plaka ya 16 CAF 273 ya da 34 S 2054."

Duyulmayan sayıyı veya harfi uydurma.
`.trim(),

                  keywords: [
                    "HDI Sigorta",
                    "HDI Plus",
                    "hasar dosyası",
                    "dosya numarası",
                    "poliçe numarası",
                    "TCKN",
                    "VKN",
                    "partaj",
                    "partaj kodu",
                    "acente",
                    "mağdur",
                    "servis",
                    "servis anlaşma kodu",
                    "eksper",
                    "eksper anlaşma kodu",
                    "evrak",
                    "ödeme",
                    "IBAN",
                    "plaka",
                    "trafik",
                    "kasko",
                  ],
                },

                noise_reduction: {
                  type: "near_field",
                },

                turn_detection: {
                  type: "server_vad",

                  threshold: 0.46,

                  prefix_padding_ms: 220,

                  /*
                   * 420 yerine 300:
                   * cevap başlatmak için daha az
                   * sessizlik bekliyoruz.
                   */
                  silence_duration_ms: 300,

                  /*
                   * Realtime kendi iş cevabını
                   * üretmiyor.
                   */
                  create_response: false,

                  /*
                   * Talha konuşurken mikrofon
                   * kendi sesini duyup cevabı
                   * kesmesin.
                   */
                  interrupt_response: false,
                },
              },

              output: {
                voice: "cedar",

                speed: 1.18,
              },
            },
          },
        }),
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Realtime session:",
        data
      );

      return Response.json(
        {
          error:
            data?.error?.message ||
            "Realtime oturumu oluşturulamadı.",
        },
        {
          status:
            response.status,
        }
      );
    }

    return Response.json(data);
  } catch (error) {
    console.error(
      "Realtime session error:",
      error
    );

    return Response.json(
      {
        error:
          "Sesli görüşme oturumu oluşturulurken hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}
