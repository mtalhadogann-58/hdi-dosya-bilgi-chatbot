const clean = (v) => String(v ?? "").replace(/\s+/g, "").toUpperCase();

export function needsProtectedData(text = "") {
  const t = text.toLocaleLowerCase("tr-TR");
  return /(dosya|hasar|poliçe|police|ödeme|odeme|iban|eksper|evrak|servis|tazminat|mağdur|magdur|plaka|kaza)/i.test(t);
}

export function deterministicVerification(extracted, profiles) {
  const role = extracted?.role || null;
  const fields = extracted?.verification || {};
  if (!role || !profiles[role]) return { status: "NEEDS_ROLE", role: null };

  const p = profiles[role];
  const eq = (a, b) => clean(a) && clean(a) === clean(b);

  if (role === "sigortali") {
    const ok = eq(fields.tckn, p.tckn) && (
      eq(fields.policeNo, p.policeNo) ||
      eq(fields.dosyaNo, p.dosyaNo) ||
      (eq(fields.dogumTarihi, p.dogumTarihi) && eq(fields.plaka, p.plaka))
    );
    return { status: ok ? "VERIFIED" : "NEEDS_FIELDS", role };
  }

  if (role === "magdur") {
    const ok = eq(fields.tckn, p.tckn) && (
      eq(fields.policeNo, p.policeNo) ||
      eq(fields.dosyaNo, p.dosyaNo) ||
      (eq(fields.dogumTarihi, p.dogumTarihi) && eq(fields.plaka, p.plaka))
    );
    return { status: ok ? "VERIFIED" : "NEEDS_FIELDS", role };
  }

  if (role === "servis") {
    const ok = (eq(fields.servisKodu, p.servisKodu) || eq(fields.vkn, p.vkn)) &&
      (eq(fields.dosyaNo, p.dosyaNo) || eq(fields.policeNo, p.policeNo));
    return { status: ok ? "VERIFIED" : "NEEDS_FIELDS", role };
  }

  if (role === "acente") {
    const ok = eq(fields.partajNo, p.partajNo) &&
      (eq(fields.dosyaNo, p.dosyaNo) || eq(fields.policeNo, p.policeNo) || eq(fields.plaka, p.plaka));
    return { status: ok ? "VERIFIED" : "NEEDS_FIELDS", role };
  }

  return { status: "NEEDS_FIELDS", role };
}

export function verificationPrompt(role) {
  if (!role) {
    return "Elbette yardımcı olabilirim. Dosya ve poliçe bilgileri kişisel veri içerdiği için önce kısa bir doğrulama yapmam gerekiyor. Başvuruyu hangi sıfatla yapıyorsunuz: sigortalı, mağdur, acente ya da servis olarak mı?";
  }
  const prompts = {
    sigortali: "Sigortalı olarak doğrulama için TCKN ile birlikte poliçe numarası veya dosya numarası paylaşabilirsiniz. Alternatif olarak TCKN, doğum tarihi ve plaka bilgisini birlikte iletebilirsiniz.",
    magdur: "Mağdur olarak doğrulama için TCKN ile birlikte poliçe veya dosya numarasını paylaşabilirsiniz. Alternatif olarak TCKN, doğum tarihi ve plaka bilgisini birlikte iletebilirsiniz.",
    servis: "Servis doğrulaması için servis kodu veya VKN ile birlikte poliçe ya da dosya numarasını paylaşabilir misiniz?",
    acente: "Acente doğrulaması için partaj numarası ile birlikte poliçe, dosya veya plaka bilgisinden birini paylaşabilir misiniz?"
  };
  return prompts[role] || "Kimlik doğrulaması için gerekli bilgileri paylaşabilir misiniz?";
}

export function filterContextByRole(role, demo) {
  const base = {
    policy: demo.policy,
    claim: demo.claim
  };

  if (role === "magdur") {
    return {
      policy: {
        policeNo: demo.policy.policeNo,
        urunAd: demo.policy.urunAd,
        bransAd: demo.policy.bransAd
      },
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
