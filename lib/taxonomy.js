export const TAXONOMY = {
  kayitTuru: ["Bilgi Talebi", "İşlem Talebi", "Şikayet"],
  anaKategori: ["Hasar", "Poliçe", "Genel"],
  brans: ["Trafik", "Kasko", "Bilinmiyor"]
};

export function validateTask(task = {}) {
  const safe = {
    kayitTuru: TAXONOMY.kayitTuru.includes(task.kayitTuru) ? task.kayitTuru : "Bilgi Talebi",
    anaKategori: TAXONOMY.anaKategori.includes(task.anaKategori) ? task.anaKategori : "Genel",
    altKategori: String(task.altKategori || "Diğer").slice(0, 80),
    altAltKategori: String(task.altAltKategori || "Diğer").slice(0, 80),
    brans: TAXONOMY.brans.includes(task.brans) ? task.brans : "Bilinmiyor",
    konu: String(task.konu || "Genel bilgi").slice(0, 180)
  };
  return safe;
}
