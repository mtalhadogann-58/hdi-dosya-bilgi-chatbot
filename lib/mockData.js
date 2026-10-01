// Paylaşılan müşteri/poliçe/hasar response yapılarından uyarlanmış maskeli PoC verisidir.
export const DEMO = {
  verificationProfiles: {
    sigortali: {
      label: "Sigortalı",
      tckn: "11111111111",
      dogumTarihi: "1990-01-01",
      dosyaNo: "294551",
      policeNo: "2000294688416",
      plaka: "16AD630"
    },
    magdur: {
      label: "Mağdur",
      tckn: "22222222222",
      dogumTarihi: "1992-02-02",
      dosyaNo: "294551",
      policeNo: "2000294688416",
      plaka: "16CAF273"
    },
    servis: {
      label: "Servis",
      vkn: "6360039002",
      servisKodu: "3840",
      dosyaNo: "294551",
      policeNo: "2000294688416"
    },
    acente: {
      label: "Acente",
      partajNo: "7693",
      dosyaNo: "294551",
      policeNo: "2000294688416",
      plaka: "16AD630"
    }
  },
  customer: {
    musteriId: "DEMO-CUST-001",
    musteriTipi: "GERCEK",
    adSoyad: "Demo Müşteri",
    kimlikNo: "11111111111",
    dogumTarihi: "1990-01-01",
    telefon: "+90 5** *** ** 11"
  },
  policy: {
    policeNo: "2000294688416",
    yenilemeNo: "0",
    zeylNo: "0",
    urunKod: "310",
    urunAd: "TRAFİK SİGORTALARI",
    bransAd: "TRAFİK",
    baslangicTarihi: "2026-03-24",
    bitisTarihi: "2027-03-24",
    sigortaliPlakaNo: "16AD630",
    acenteKod: "7693",
    acenteAd: "Demo Sigorta Acentesi"
  },
  claim: {
    kaynakSistem: "PLUS",
    hasarDosyaNo: "294551",
    hasarKisimNo: null,
    dosyaDurumuAciklama: "KESİN EKSPER RAPORU GELDİ",
    dosyaIncelemeDurumu: "UZMAN KESİN RAPORU GELDİ",
    ihbarTarihi: "2026-07-02",
    hasarTarihi: "2026-07-02",
    hasarNeden: "ARACA ÇARPMA",
    bransAd: "TRAFİK",
    dosyaTipiAciklama: "EKSPERLİ DOSYA",
    dosyaTuru: "HASAR",
    sigortaliMusteriAd: "Demo Müşteri",
    sigortaliKimlikNo: "11111111111",
    sigortaliPlakaNo: "16AD630",
    magdurAdSoyad: "Demo Mağdur",
    magdurKimlikNo: "22222222222",
    magdurPlaka: "16CAF273",
    kusurDestekGorus: "KUSUR DESTEK GÖRÜŞÜ GELDİ",
    eksperAdi: "Demo Eksper",
    eksperTelefonNo: "+90 5** *** ** 90",
    eksperMail: "demo.eksper@example.com",
    eksikEvrakSayisi: 6,
    servisList: [{
      servisKod: "3840",
      vknNo: "6360039002",
      servisAd: "Demo Otomotiv Servisi",
      servisTel: "+90 5** *** ** 58",
      servisMail: "demo.servis@example.com"
    }],
    odemeList: [],
    hesapOzetlerList: [],
    dosyaDurumList: [
      { durumKod: "50", aciklama: "DOSYA AÇILDI", guncellemeTarihi: null },
      { durumKod: "60", aciklama: "EKSPER ATANDI", guncellemeTarihi: null },
      { durumKod: "90", aciklama: "KESİN EKSPER RAPORU GELDİ", guncellemeTarihi: null }
    ]
  }
};
