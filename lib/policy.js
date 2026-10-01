export const ROLE_OPTIONS = [
  { label: "Sigortalı", value: "Sigortalıyım" },
  { label: "Mağdur", value: "Mağdurum" },
  { label: "Acente", value: "Acenteyim" },
  { label: "Servis", value: "Servisim" },
  { label: "Avukat", value: "Avukatım" },
  { label: "Firma Yetkilisi", value: "Firma yetkilisiyim" }
];

export const VERIFICATION_POLICIES = {
  sigortali: {
    primary: ["tckn"],
    alternatives: [["dosyaNo"], ["policeNo"], ["dogumTarihi", "plaka"]]
  },
  magdur: {
    primary: ["tckn"],
    alternatives: [["dosyaNo"], ["policeNo"], ["dogumTarihi", "plaka"]]
  },
  servis: {
    primaryAlternatives: [["servisKodu"], ["vkn"]],
    alternatives: [["dosyaNo"], ["policeNo"]]
  },
  acente: {
    primary: ["partajNo"],
    alternatives: [["dosyaNo"], ["policeNo"], ["plaka"]]
  },
  avukat: { manual: true, reason: "Vekâlet kontrolü PoC datasında yok." },
  firma_yetkilisi: { manual: true, reason: "Firma yetkilisi doğrulaması PoC datasında yok." }
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
