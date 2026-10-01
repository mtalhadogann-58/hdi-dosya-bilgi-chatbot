const clean = (v) => String(v ?? "").replace(/\s+/g, "").toUpperCase();
const digits = (v) => String(v ?? "").replace(/\D/g, "");

export function needsProtectedData(text = "") {
  const t = text.toLocaleLowerCase("tr-TR");
  return /(dosya|hasar|poliçe|police|ödeme|odeme|iban|eksper|evrak|servis|tazminat|mağdur|magdur|plaka|kaza)/i.test(t);
}

export const ROLE_LABELS = {
  sigortali: "sigortalı",
  magdur: "mağdur",
  acente: "acente",
  servis: "servis",
  avukat: "avukat",
  firma_yetkilisi: "firma yetkilisi",
  sigortali_yakini: "sigortalı yakını",
  magdur_yakini: "mağdur yakını",
  ucuncu_sahis: "3. şahıs"
};

export function emptyVerificationState() {
  return {
    status: "UNVERIFIED",
    role: null,
    expectedField: null,
    primaryVerified: false,
    secondaryVerified: false,
    primaryField: null,
    attempts: 0
  };
}

function eq(a, b) {
  return clean(a) && clean(a) === clean(b);
}

function valueFromLatest(latest, field, extracted = {}) {
  const v = extracted?.verification || {};
  if (field === "tckn") return v.tckn || digits(latest);
  if (field === "partajNo") return v.partajNo || digits(latest);
  if (field === "vkn") return v.vkn || digits(latest);
  if (field === "servisKimlik") return v.servisKodu || v.vkn || digits(latest);
  if (field === "dosyaNo") return v.dosyaNo || digits(latest);
  if (field === "policeNo") return v.policeNo || digits(latest);
  return "";
}

function roleProfile(role, profiles) {
  if (role === "servis") return profiles.servis;
  return profiles[role];
}

export function rolePrompt() {
  return "Elbette yardımcı olabilirim. Önce doğru doğrulama yöntemini seçebilmem için hangi sıfatla işlem yaptığınızı netleştireyim: sigortalı, mağdur, acente, servis, avukat veya firma yetkilisi olarak mı başvuruyorsunuz?";
}

function primaryPrompt(role) {
  const prompts = {
    sigortali: "Teşekkürler. Önce T.C. kimlik numaranızı paylaşır mısınız?",
    magdur: "Teşekkürler. Önce T.C. kimlik numaranızı paylaşır mısınız?",
    acente: "Teşekkürler. Önce partaj numaranızı paylaşır mısınız?",
    servis: "Teşekkürler. Önce servis kodunuzu veya VKN'nizi paylaşır mısınız?",
    avukat: "Teşekkürler. Önce T.C. kimlik numaranızı paylaşır mısınız?",
    firma_yetkilisi: "Teşekkürler. Önce şirket VKN'sini paylaşır mısınız?"
  };
  return prompts[role] || rolePrompt();
}

function secondaryPrompt(role) {
  if (["sigortali", "magdur"].includes(role)) {
    return "Teşekkürler, ilk doğrulama adımı tamamlandı. Şimdi hasar dosya numaranızı paylaşır mısınız? Dosya numaranız yoksa “poliçe ile devam” yazabilirsiniz.";
  }
  if (role === "acente") return "Partaj numaranız doğrulandı. Şimdi dosya numarasını paylaşır mısınız? Dosya numarası yoksa poliçe numarasıyla da devam edebiliriz.";
  if (role === "servis") return "Servis bilginiz doğrulandı. Şimdi hasar dosya numarasını paylaşır mısınız? Dosya numarası yoksa poliçe numarasıyla da devam edebiliriz.";
  if (role === "avukat") return "T.C. kimlik numaranız doğrulandı. Şimdi dosya numarasını paylaşır mısınız? PoC verisinde ayrıca vekâlet kontrolü olmadığı için dosya eşleşmesinden sonra temsilci kontrolü gerekecek.";
  if (role === "firma_yetkilisi") return "VKN doğrulandı. Şimdi dosya numarasını paylaşır mısınız? Dosya numarası yoksa poliçe numarasıyla da devam edebiliriz.";
  return "Şimdi dosya numarasını paylaşır mısınız?";
}

function noAccessMessage(role) {
  if (role === "magdur_yakini") return "Mağdur yakını olarak dosya bilgisi paylaşamıyorum. Bilgi güvenliği nedeniyle mağdurun bizzat başvurması gerekiyor.";
  if (role === "ucuncu_sahis") return "Bu başvuru türünde kişisel veya dosya bilgisi paylaşamıyorum.";
  if (role === "sigortali_yakini") return "Sigortalı yakını başvurusunda doğrulama için sigortalının sürece dahil olması gerekiyor. Bu PoC'de bu doğrulama akışını otomatik tamamlayamıyorum.";
  return null;
}

export function advanceVerification({ latest, extracted, session, profiles }) {
  const next = { ...emptyVerificationState(), ...(session || {}) };
  const explicitRole = extracted?.role || null;

  if (explicitRole && explicitRole !== next.role) {
    Object.assign(next, emptyVerificationState(), { role: explicitRole });
  }

  if (!next.role) {
    if (!explicitRole) return { session: next, message: rolePrompt() };
    next.role = explicitRole;
  }

  const blocked = noAccessMessage(next.role);
  if (blocked) {
    next.status = "BLOCKED";
    return { session: next, message: blocked };
  }

  const p = roleProfile(next.role, profiles);
  if (!p) {
    next.status = "NEEDS_AGENT";
    return { session: next, message: "Bu başvuru türü için PoC doğrulama verisi bulunmuyor. Canlı yapıda ilgili doğrulama servisine yönlendirilmesi gerekir." };
  }

  if (!next.primaryVerified) {
    let primaryField = next.expectedField;
    if (!primaryField || !["tckn", "partajNo", "servisKimlik", "vkn"].includes(primaryField)) {
      primaryField = ["sigortali", "magdur", "avukat"].includes(next.role) ? "tckn" : next.role === "acente" ? "partajNo" : next.role === "servis" ? "servisKimlik" : "vkn";
      next.expectedField = primaryField;
      if (!explicitRole && !valueFromLatest(latest, primaryField, extracted)) {
        return { session: next, message: primaryPrompt(next.role) };
      }
    }

    const value = valueFromLatest(latest, primaryField, extracted);
    if (!value) return { session: next, message: primaryPrompt(next.role) };

    if (primaryField === "tckn" && digits(value).length !== 11) {
      next.attempts += 1;
      return { session: next, message: "Bu bilgi geçerli bir T.C. kimlik numarası formatında görünmüyor. 11 haneli TCKN'nizi kontrol edip tekrar paylaşır mısınız?" };
    }
    if (primaryField === "vkn" && digits(value).length !== 10) {
      next.attempts += 1;
      return { session: next, message: "Bu bilgi geçerli bir VKN formatında görünmüyor. 10 haneli VKN'yi kontrol edip tekrar paylaşır mısınız?" };
    }

    let ok = false;
    if (primaryField === "tckn") ok = eq(value, p.tckn);
    if (primaryField === "partajNo") ok = eq(value, p.partajNo);
    if (primaryField === "vkn") ok = eq(value, p.vkn);
    if (primaryField === "servisKimlik") ok = eq(value, p.servisKodu) || eq(value, p.vkn);

    if (!ok) {
      next.attempts += 1;
      const label = primaryField === "tckn" ? "TCKN" : primaryField === "partajNo" ? "partaj numarası" : primaryField === "servisKimlik" ? "servis kodu/VKN" : "VKN";
      return { session: next, message: `Paylaştığınız ${label} ile bu başvuru rolünde eşleşen kayıt bulamadım. Bilgiyi veya başvuru sıfatınızı kontrol edip tekrar deneyebilir misiniz?` };
    }

    next.primaryVerified = true;
    next.primaryField = primaryField;
    next.expectedField = "dosyaNo";
    return { session: next, message: secondaryPrompt(next.role) };
  }

  if (!next.secondaryVerified) {
    const lower = String(latest || "").toLocaleLowerCase("tr-TR");
    if (/poli[cç]e ile devam|poli[cç]e numara/.test(lower)) next.expectedField = "policeNo";

    const extractedVerification = extracted?.verification || {};
    if (extractedVerification.policeNo && !extractedVerification.dosyaNo) next.expectedField = "policeNo";
    if (extractedVerification.dosyaNo) next.expectedField = "dosyaNo";

    const field = next.expectedField || "dosyaNo";
    const value = valueFromLatest(latest, field, extracted);
    if (!value || /poli[cç]e ile devam/.test(lower)) {
      return { session: next, message: field === "policeNo" ? "Elbette. Poliçe numaranızı paylaşır mısınız?" : secondaryPrompt(next.role) };
    }

    const ok = field === "dosyaNo" ? eq(value, p.dosyaNo) : eq(value, p.policeNo);
    if (!ok) {
      next.attempts += 1;
      const label = field === "dosyaNo" ? "dosya numarasını" : "poliçe numarasını";
      const alt = field === "dosyaNo" ? " İsterseniz poliçe numarasıyla da devam edebiliriz." : "";
      return { session: next, message: `Paylaştığınız ${label}, ilk adımda doğruladığımız kayıtla eşleşmedi. Numarayı kontrol edip tekrar paylaşır mısınız?${alt}` };
    }

    if (next.role === "avukat") {
      next.status = "NEEDS_AGENT";
      next.secondaryVerified = true;
      return { session: next, message: "Kimlik ve dosya eşleşmesi doğrulandı. Ancak avukat başvurusunda dosyada vekâlet kontrolü de gerekiyor; bu PoC verisinde vekâlet alanı bulunmadığı için işlemi temsilci kontrolüne aktarmak gerekir." };
    }

    next.secondaryVerified = true;
    next.status = "VERIFIED";
    next.expectedField = null;
    return { session: next, verifiedNow: true };
  }

  next.status = "VERIFIED";
  return { session: next, verifiedNow: true };
}

export function filterContextByRole(role, demo) {
  const base = { policy: demo.policy, claim: demo.claim };
  if (role === "magdur") {
    return {
      policy: { policeNo: demo.policy.policeNo, urunAd: demo.policy.urunAd, bransAd: demo.policy.bransAd },
      claim: {
        hasarDosyaNo: demo.claim.hasarDosyaNo,
        dosyaDurumuAciklama: demo.claim.dosyaDurumuAciklama,
        dosyaIncelemeDurumu: demo.claim.dosyaIncelemeDurumu,
        ihbarTarihi: demo.claim.ihbarTarihi,
        hasarTarihi: demo.claim.hasarTarihi,
        hasarNeden: demo.claim.hasarNeden,
        magdurAdSoyad: demo.claim.magdurAdSoyad,
        magdurPlaka: demo.claim.magdurPlaka,
        eksperAdi: demo.claim.eksperAdi,
        eksperTelefonNo: demo.claim.eksperTelefonNo,
        eksikEvrakSayisi: demo.claim.eksikEvrakSayisi,
        servisList: demo.claim.servisList,
        odemeList: demo.claim.odemeList,
        dosyaDurumList: demo.claim.dosyaDurumList
      }
    };
  }
  if (role === "servis") {
    return {
      policy: { policeNo: demo.policy.policeNo, bransAd: demo.policy.bransAd },
      claim: {
        hasarDosyaNo: demo.claim.hasarDosyaNo,
        dosyaDurumuAciklama: demo.claim.dosyaDurumuAciklama,
        dosyaIncelemeDurumu: demo.claim.dosyaIncelemeDurumu,
        ihbarTarihi: demo.claim.ihbarTarihi,
        hasarTarihi: demo.claim.hasarTarihi,
        hasarNeden: demo.claim.hasarNeden,
        eksperAdi: demo.claim.eksperAdi,
        eksperTelefonNo: demo.claim.eksperTelefonNo,
        eksikEvrakSayisi: demo.claim.eksikEvrakSayisi,
        servisList: demo.claim.servisList,
        dosyaDurumList: demo.claim.dosyaDurumList
      }
    };
  }
  return { customer: demo.customer, ...base };
}
