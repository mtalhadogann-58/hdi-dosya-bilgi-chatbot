export const runtime =
  "nodejs";


const REALTIME_MODEL =
  process.env
    .OPENAI_REALTIME_MODEL ||
  "gpt-realtime-2.1";


export async function POST() {

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


    const response =
      await fetch(
        "https://api.openai.com/v1/realtime/client_secrets",
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${process.env.OPENAI_API_KEY}`,

            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              session: {
                type:
                  "realtime",

                model:
                  REALTIME_MODEL,

                output_modalities:
                  [
                    "audio"
                  ],

                instructions:
                  `
Sen HDI Sigorta AI Assistant Talha'nın ses katmanısın.

Talha genç yetişkin bir ERKEK dijital asistandır.

Türkçe konuşursun.

Bu bir IVR değildir.
Bir çağrı merkezi anonsu değildir.
Metin okuyan spiker gibi konuşmazsın.

Gerçek bir müşteri temsilcisinin telefonda konuştuğu gibi:
- rahat,
- doğal,
- sıcak,
- kendinden emin,
- hızlı ama anlaşılır,
- insansı

konuşursun.

Gereksiz duraklama yapma.

Her kelimeyi ayrı ayrı vurgulama.

Cümle sonlarını uzatma.

Aşırı resmi veya teatral ses kullanma.

Yanıtı kısa tutan bir konuşma temposu kullan.

Normal insan konuşmasından hafif hızlı konuş.

İş cevabını kendin üretme.

Uygulama sana HDI backend agent'ın ürettiği metni verecek.

Verilen metni:
- değiştirme,
- yeni bilgi ekleme,
- bilgi çıkarma,
- yalnızca doğal şekilde seslendir.

Sayıları anlaşılır söyle.

Dosya numarası, poliçe numarası,
TCKN, VKN, partaj, servis kodu,
eksper kodu ve plakaları dikkatli söyle.
`.trim(),

                audio: {

                  input: {

                    transcription: {
                      model:
                        "gpt-live-transcribe",

                      delay:
                        "medium",

                      languages:
                        [
                          "tr"
                        ],

                      prompt:
                        `
Bu HDI Sigorta müşteri hizmetleri hasar görüşmesidir.

Konuşma dili Türkçedir.

Sigorta terminolojisini ve özellikle sayısal bilgileri dikkatli yaz.

Geçebilecek terimler:

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

Türkçe harfleri doğru yaz.

Plakalarda harfleri kaybetme.

Örnek:
"on altı a de altı yüz otuz"
→ "16 AD 630"

Örnek:
"on altı ce a fe iki yüz yetmiş üç"
→ "16 CAF 273"

Kullanıcı bir alan için birden fazla alternatif söylüyorsa hepsini transcriptte koru.

Örnek:
"plaka ya 16 CAF 273 ya da 34 S 2054"

→
"Plaka ya 16 CAF 273 ya da 34 S 2054."

Sayıları uydurma.
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
                        "kasko"
                      ]
                    },


                    noise_reduction: {
                      type:
                        "near_field"
                    },


                    /*
                     * Kullanıcının yaklaşık
                     * 420ms susması turn'ü kapatır.
                     *
                     * Realtime kendisi cevap
                     * üretmez.
                     *
                     * İş cevabını V6 backend
                     * üretir.
                     */
                    turn_detection: {
                      type:
                        "server_vad",

                      threshold:
                        0.46,

                      prefix_padding_ms:
                        240,

                      silence_duration_ms:
                        420,

                      create_response:
                        false,

                      interrupt_response:
                        true
                    }
                  },


                  output: {

                    /*
                     * Ash yerine kalite için
                     * Cedar deniyoruz.
                     */
                    voice:
                      "cedar",

                    /*
                     * Playback biraz hızlanır.
                     * Prompt ayrıca konuşma
                     * temposunu doğal biçimde
                     * hızlandırıyor.
                     */
                    speed:
                      1.12
                  }
                }
              }
            })
        }
      );


    const data =
      await response.json();


    if (
      !response.ok
    ) {
      console.error(
        "Realtime session:",
        data
      );

      return Response.json(
        {
          error:
            data
              ?.error
              ?.message ||
            "Realtime oturumu oluşturulamadı."
        },
        {
          status:
            response.status
        }
      );
    }


    return Response.json(
      data
    );


  } catch (
    error
  ) {

    console.error(
      "Realtime session error:",
      error
    );


    return Response.json(
      {
        error:
          "Sesli görüşme oturumu oluşturulurken hata oluştu."
      },
      {
        status: 500
      }
    );

  }
}
