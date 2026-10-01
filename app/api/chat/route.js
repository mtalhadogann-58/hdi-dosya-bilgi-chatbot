import OpenAI from "openai";
import { DEMO } from "../../../lib/mockData";
import {
  deterministicVerification,
  filterContextByRole,
  needsProtectedData,
  verificationPrompt
} from "../../../lib/rules";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-terra";

function safeJson(text) {
  try {
    const cleaned = String(text || "")
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function historyText(messages = []) {
  return messages.slice(-12).map((m) => `${m.role === "assistant" ? "ASİSTAN" : "MÜŞTERİ"}: ${m.content}`).join("\n");
}

async function understand(messages) {
  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: "low" },
    instructions: `Sen HDI Sigorta dijital asistanının niyet ve veri çıkarım katmanısın. Türkçe mesajları doğal biçimde anla.
Sadece JSON üret. Şema:
{
  "intent":"greeting|general|claim_status|payment|documents|expert|service|policy|complaint|transaction|other",
  "protected": true|false,
  "role":"sigortali|magdur|servis|acente|null",
  "verification": {"tckn":null,"vkn":null,"partajNo":null,"servisKodu":null,"dosyaNo":null,"policeNo":null,"plaka":null,"dogumTarihi":null},
  "task": {"kayitTuru":"Bilgi Talebi|İşlem Talebi|Şikayet","anaKategori":"Hasar|Poliçe|Genel","altKategori":"string","altAltKategori":"string","brans":"Trafik|Kasko|Bilinmiyor","konu":"string"},
  "smallTalkReply":"string|null"
}
Kurallar: Selamlaşma tek başına protected=false. Müşterinin kendi dosya/poliçe/ödeme/eksper/evrak bilgisini istemesi protected=true. Sadece öfkeli olması Şikayet değildir; açık memnuniyetsizlik/itiraz varsa Şikayet. Aksiyon istiyorsa İşlem Talebi. Bilgi soruyorsa Bilgi Talebi. Kimlik numaralarını aynen çıkar ama cevapta tekrar etme.`,
    input: historyText(messages)
  });
  return safeJson(response.output_text) || {
    intent: "other",
    protected: needsProtectedData(messages.at(-1)?.content),
    role: null,
    verification: {},
    task: { kayitTuru: "Bilgi Talebi", anaKategori: "Genel", altKategori: "Diğer", altAltKategori: "Diğer", brans: "Bilinmiyor", konu: "Genel bilgi" },
    smallTalkReply: null
  };
}

async function answerWithContext(messages, role, task) {
  const context = filterContextByRole(role, DEMO);
  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: "low" },
    instructions: `Sen HDI Sigorta Dijital Asistanısın. Kurumsal ama samimi, sakin ve doğal Türkçe kullan.
Kullanıcıyı menülere zorlamazsın. Selamlamaya selamlamayla cevap verirsin. Aynı mesajdaki birden fazla soruyu birlikte ele alırsın. Önceki konuşmanın bağlamını korursun.
Aşağıdaki CONTEXT yalnızca doğrulanmış kullanıcıya ait paylaşılabilir demo veridir. Sadece bu veriden kanıtlanan bilgileri söyle; boş/null/verilmeyen bilgiyi uydurma.
Dosya kapanmış demek için açıkça DOSYA KAPANDI/kapalı kanıtı gerekir. Ödeme listesi boşsa ödeme tarihi veya tutarı üretme. Statü tarihleri null ise SLA/gün hesabı yapma. EksikEvrakSayisi yalnızca sayıdır; belge adlarını uydurma. "KESİN EKSPER RAPORU GELDİ" ise raporun geldiğini ve inceleme/değerlendirme tarafına geçtiğini söyleyebilirsin; ödeme kararı çıkmış gibi konuşma.
Mağdura yalnızca kendi işlemiyle ilgili bilgi ver. Servis rolünde kişisel veri paylaşma.
Müşteri işlem veya şikayet talep ederse, bunun kayıt/temsilci aksiyonu gerektirdiğini açıkça söyle; PoC içinde işlemi gerçekten yaptığını iddia etme.
Yanıt 2-6 cümle olsun; gerekirse tek bir netleştirme sorusu sor.

CONTEXT:\n${JSON.stringify(context, null, 2)}\n\nTASK ETİKETİ:\n${JSON.stringify(task, null, 2)}`,
    input: historyText(messages)
  });
  return response.output_text.trim();
}

async function answerGeneral(messages, understood) {
  if (understood.smallTalkReply && ["greeting", "general"].includes(understood.intent)) {
    return understood.smallTalkReply;
  }
  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: "low" },
    instructions: `Sen HDI Sigorta Dijital Asistanısın. Kurumsal ama samimi, doğal ve kısa Türkçe kullan. Selamlaşmaya sadece selamlaş; kullanıcı daha ihtiyacını söylemeden dosya seçtirme veya kimlik doğrulama başlatma. Genel sorulara yardımcı ol. Kişisel dosya/poliçe/ödeme bilgisi istenirse kullanıcıya bilgi vermeden kimlik doğrulamasına geçileceğini belirt.`,
    input: historyText(messages)
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
    if (!messages.length) return Response.json({ error: "Mesaj bulunamadı." }, { status: 400 });

    const understood = await understand(messages);
    const latest = messages.at(-1)?.content || "";
    const protectedRequest = Boolean(understood.protected || needsProtectedData(latest));

    if (!protectedRequest) {
      const message = await answerGeneral(messages, understood);
      return Response.json({ message, verification: { status: "NOT_REQUIRED", role: understood.role }, task: understood.task, intent: understood.intent, model: MODEL });
    }

    const verification = deterministicVerification(understood, DEMO.verificationProfiles);
    if (verification.status !== "VERIFIED") {
      return Response.json({
        message: verificationPrompt(verification.role || understood.role),
        verification,
        task: understood.task,
        intent: understood.intent,
        model: MODEL
      });
    }

    const message = await answerWithContext(messages, verification.role, understood.task);
    return Response.json({ message, verification, task: understood.task, intent: understood.intent, model: MODEL });
  } catch (error) {
    console.error(error);
    return Response.json({
      error: "Model bağlantısında beklenmeyen bir hata oluştu.",
      detail: process.env.NODE_ENV === "development" ? String(error?.message || error) : undefined
    }, { status: 500 });
  }
}
