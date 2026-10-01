export const ROLE_OPTIONS = [
  { label: "Sigortalı", value: "Sigortalıyım" },
  { label: "Mağdur", value: "Mağdurum" },
  { label: "Acente", value: "Acenteyim" },
  { label: "Servis", value: "Servisim" },
  { label: "Avukat", value: "Avukatım" },
  { label: "Firma Yetkilisi", value: "Firma yetkilisiyim" }
];

// V5 PoC kuralı: doğrulama tek bir zorunlu alana kilitlenmez.
// Rol için tanımlanan güvenli alanlardan en az minMatches kadar bağımsız eşleşme aranır.
// Bu, mevcut operasyon prosedüründen daha esnek bir PoC kuralıdır ve canlı öncesi onaylanmalıdır.
export const VERIFICATION_POLICIES = {
  sigortali: {
    minMatches: 2,
    allowedFields: ["tckn", "dosyaNo", "policeNo", "plaka", "dogumTarihi"],
    preferredFields: ["tckn", "dosyaNo", "policeNo", "plaka"]
  },
  magdur: {
    minMatches: 2,
    allowedFields: ["tckn", "dosyaNo", "policeNo", "plaka", "dogumTarihi"],
    preferredFields: ["tckn", "dosyaNo", "plaka"]
  },
  acente: {
    minMatches: 2,
    allowedFields: ["partajNo", "dosyaNo", "policeNo", "plaka"],
    preferredFields: ["partajNo", "dosyaNo", "policeNo", "plaka"]
  },
  servis: {
    minMatches: 2,
    allowedFields: ["servisKodu", "vkn", "dosyaNo", "policeNo", "plaka"],
    preferredFields: ["servisKodu", "vkn", "dosyaNo", "policeNo"]
  },
  avukat: {
    manual: true,
    reason: "Vekâlet kontrolü PoC datasında bulunmuyor."
  },
  firma_yetkilisi: {
    manual: true,
    reason: "Firma yetkisi/temsil ilişkisi PoC datasında bulunmuyor."
  }
};

export function canShare({ role, verified, dataType }) {
  if (!verified) return { decision: "DENY", reason: "IDENTITY_NOT_VERIFIED" };
  if (role === "servis" && ["customer_identity", "payment_recipient_private"].includes(dataType)) {
    return { decision: "DENY", reason: "ROLE_NOT_AUTHORIZED" };
  }
  if (role === "magdur" && dataType === "insured_private") {
    return { decision: "DENY", reason: "ROLE_NOT_AUTHORIZED" };
  }
  return { decision: "ALLOW" };
}
