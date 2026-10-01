import OpenAI from "openai";
import { DEMO } from "../../../lib/mockData";
import { advanceVerification, filterContextByRole, needsProtectedData } from "../../../lib/rules";

export const runtime = "nodejs";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-terra";

function safeJson(text) {
  try {
    return JSON.parse(String(text || "").replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
  } catch { return null; }
}

function historyText(messages = []) {
  return messages.slice(-12).map((m) => `${m.role === "assistant" ? "ASİSTAN" : "MÜŞTERİ"}: ${m.content}`).join("\n");
}

async function understandLatest(latest) {
  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: "low" },
    instructions: `Sen HDI Sigorta dijital asistanının NLU katmanısın. YALNIZCA son kullanıcı mesajını analiz et ve sadece JSON üret.
Şema:
{
 "intent":"greeting|general|claim_status|payment|documents|expert|service|policy|complaint|transaction|other",
 "protected":true|false,
 "role":"sigortali|magdur|acente|servis|avukat|firma_yetkilisi|sigortali_yakini|magdur_yakini|ucuncu_sahis|null",
 "verification":{"tckn":null,"vkn":null,"partajNo":null,"servisKodu":null,"dosyaNo":null,"policeNo":null,"plaka":null,"dogumTarihi":null},
 "task":{"kayitTuru":"Bilgi Talebi|İşlem Talebi|Şikayet","anaKategori":"Hasar|Poliçe|Genel","altKategori":"string","altAltKategori":"string","brans":"Trafik|Kasko|Bilinmiyor","konu":"string"},
 "smallTalkReply":"string|null"
}
ROL KURALI ÇOK ÖNEMLİ: Rolü yalnızca kullanıcı açıkça söylüyorsa doldur. "Dosyam", "hasarım", "benim aracım" ifadelerinden sigortalı rolü ÇIKARMA. "Acenteyim", "servisten arıyorum", "mağdurum", "sigortalıyım" gibi açık ifadeler olmalı.
Kimlik/dosya numaralarını yalnız mesajda açıkça varsa çıkar. Önceki mesajlardan tahmin etme.
Selamlaşma protected=false. Kişisel dosya/poliçe/ödeme/eksper/evrak isteği protected=true.
Sentiment tek başına Şikayet değildir.`,
    input: String(latest || "")
  });
  return safeJson(response.output_text) || { intent: "other", protected: needsProtectedData(latest), role: null, verification: {}, task: { kayitTuru: "Bilgi Talebi", anaKategori: "Genel", altKategori: "Diğer", altAltKategori: "Diğer", brans: "Bilinmiyor", konu: "Genel bilgi" }, smallTalkReply: null };
}

async function answerGeneral(messages, understood) {
  if (understood.smallTalkReply && ["greeting", "general"].includes(understood.intent)) return understood.smallTalkReply;
  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: "low" },
    instructions: "Sen HDI Sigorta Dijital Asistanısın. Kurumsal ama samimi, doğal ve kısa Türkçe kullan. Selamlaşmaya selamlaşmayla cevap ver. Kullanıcı daha ihtiyacını söylemeden kimlik doğrulama veya dosya seçimi başlatma.",
    input: historyText(messages)
  });
  return response.output_text.trim();
}

async function answerWithContext(messages, role, task) {
  const context = filterContextByRole(role, DEMO);
  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: "low" },
    instructions: `Sen HDI Sigorta Dijital Asistanısın. Kurumsal ama samimi ve doğal Türkçe kullan. Doğrulama tamamlandı; aşağıdaki veri yalnızca doğrulanmış role göre paylaşılabilir bağlamdır.
Sadece CONTEXT ile kanıtlanan bilgileri söyle. Null/boş alanı uydurma. Dosya kapandı demek için açık kapanış kanıtı gerekir. Ödeme listesi boşsa tarih/tutar üretme. Statü tarihi null ise SLA hesabı yapma. Eksik evrak sayısı belge adı değildir. "KESİN EKSPER RAPORU GELDİ" ise raporun geldiğini söyle; ödeme kararı çıkmış gibi konuşma. Mağdura yalnızca kendi işlemiyle ilgili bilgi ver. Servise kişisel veri verme.
Yanıt 2-6 cümle olsun ve gerekirse tek bir netleştirme sorusu sor.
CONTEXT:\n${JSON.stringify(context, null, 2)}\nTASK:\n${JSON.stringify(task, null, 2)}`,
    input: historyText(messages)
  });
  return response.output_text.trim();
}

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OPENAI_API_KEY tanımlı değil." }, { status: 500 });
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const session = body.session || {};
    if (!messages.length) return Response.json({ error: "Mesaj bulunamadı." }, { status: 400 });

    const latest = messages.at(-1)?.content || "";
    const understood = await understandLatest(latest);
    const protectedRequest = Boolean(session?.activeProtectedFlow || understood.protected || needsProtectedData(latest));

    if (!protectedRequest) {
      const message = await answerGeneral(messages, understood);
      return Response.json({ message, session: { ...session, activeProtectedFlow: false }, verification: { status: "NOT_REQUIRED", role: null }, task: understood.task, intent: understood.intent, model: MODEL });
    }

    const currentSession = { ...session, activeProtectedFlow: true };
    const advanced = advanceVerification({ latest, extracted: understood, session: currentSession, profiles: DEMO.verificationProfiles });
    const nextSession = { ...advanced.session, activeProtectedFlow: advanced.session.status !== "VERIFIED" };

    if (advanced.session.status !== "VERIFIED") {
      return Response.json({ message: advanced.message, session: nextSession, verification: advanced.session, task: understood.task, intent: understood.intent, model: MODEL });
    }

    const message = await answerWithContext(messages, advanced.session.role, understood.task);
    return Response.json({ message, session: nextSession, verification: advanced.session, task: understood.task, intent: understood.intent, model: MODEL });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Model bağlantısında beklenmeyen bir hata oluştu." }, { status: 500 });
  }
}
