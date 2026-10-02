// HDI CR AI V6 deterministic core.
// Tamamı sentetik PoC verisidir.

export const ROLE_OPTIONS = [
  { label: "Sigortalı", value: "Sigortalıyım", role: "sigortali" },
  { label: "Mağdur", value: "Mağdurum", role: "magdur" },
  { label: "Acente", value: "Acenteyim", role: "acente" },
  { label: "Servis", value: "Servisim", role: "servis" },
  { label: "Eksper", value: "Eksperim", role: "eksper" },
  { label: "Avukat", value: "Avukatım", role: "avukat" },
  {
    label: "Firma Yetkilisi",
    value: "Firma yetkilisiyim",
    role: "firma_yetkilisi"
  }
];

const FIELDS = [
  "dosyaNo",
  "policeNo",
  "plaka",
  "tckn",
  "vkn",
  "dogumTarihi",
  "telefon",
  "partajNo",
  "servisKodu",
  "eksperKodu"
];

/*
 * TÜM ROLLERDE ANA KURAL:
 *
 * Aynı hasar dosyasına ilişkin en az
 * 2 FARKLI bilgi tipi eşleşirse doğrulama tamamlanır.
 *
 * Örnek:
 * dosyaNo + plaka
 * dosyaNo + poliçe
 * TCKN + plaka
 * partaj + plaka
 * eksper kodu + dosya
 *
 * Partner kodları ZORUNLU değildir.
 * Yalnızca kullanıcı deneyimini hızlandıran preferred field'lardır.
 */
const POLICIES = {
  sigortali: [
    "dosyaNo",
    "policeNo",
    "plaka",
    "tckn",
    "dogumTarihi",
    "telefon"
  ],

  magdur: [
    "dosyaNo",
    "plaka",
    "tckn",
    "policeNo",
    "dogumTarihi",
    "telefon"
  ],

  acente: [
    "partajNo",
    "dosyaNo",
    "policeNo",
    "plaka",
    "tckn",
    "vkn"
  ],

  servis: [
    "servisKodu",
    "dosyaNo",
    "policeNo",
    "plaka",
    "vkn",
    "tckn"
  ],

  eksper: [
    "eksperKodu",
    "dosyaNo",
    "policeNo",
    "plaka",
    "tckn",
    "vkn"
  ],

  avukat: [
    "dosyaNo",
    "policeNo",
    "plaka",
    "tckn",
    "vkn"
  ],

  firma_yetkilisi: [
    "vkn",
    "dosyaNo",
    "policeNo",
    "plaka",
    "telefon"
  ]
};

/*
 * MOCK DATA
 *
 * Bilerek aynı araç/poliçeyle ilişkili
 * birden fazla dosya var.
 *
 * Böylece:
 * - verification
 * - ambiguity
 * - claim resolution
 * - payment
 * - expert
 * - documents
 * - partner code
 * test edilebilir.
 */
export const DEMO = {
  partners: {
    acenteler: [
      {
        partajNo: "7693",
        ad: "Demo Sigorta Acentesi",
        vkn: "1112223334"
      },
      {
        partajNo: "5412",
        ad: "Marmara Demo Acente",
        vkn: "5556667778"
      }
    ],

    servisler: [
      {
        servisKodu: "3840",
        ad: "Demo Otomotiv Servisi",
        vkn: "6360039002"
      },
      {
        servisKodu: "8221",
        ad: "Marmara Kaporta Demo",
        vkn: "4455667788"
      }
    ],

    eksperler: [
      {
        eksperKodu: "2783",
        ad: "Demo Eksper A",
        vkn: "9876543210"
      },
      {
        eksperKodu: "1092",
        ad: "Demo Eksper B",
        vkn: "1234567890"
      },
      {
        eksperKodu: "4401",
        ad: "Demo Eksper C",
        vkn: "6677889900"
      }
    ]
  },

  claims: [
    {
      hasarDosyaNo: "294551",
      policeNo: "2000294688416",

      kaynakSistem: "PLUS",

      bransAd: "TRAFİK",

      hasarTarihi: "2026-07-02",

      hasarNeden: "ARACA ÇARPMA",

      dosyaDurumuAciklama:
        "KESİN EKSPER RAPORU GELDİ",

      dosyaIncelemeDurumu:
        "UZMAN KESİN RAPORU GELDİ",

      sigortaliMusteriAd:
        "Demo Müşteri",

      sigortaliKimlikNo:
        "11111111111",

      sigortaliDogumTarihi:
        "1990-01-01",

      sigortaliTelefon:
        "905321112233",

      sigortaliPlakaNo:
        "16AD630",

      magdurAdSoyad:
        "Demo Mağdur",

      magdurKimlikNo:
        "22222222222",

      magdurDogumTarihi:
        "1992-02-02",

      magdurTelefon:
        "905322223344",

      magdurPlaka:
        "16CAF273",

      acenteKod:
        "7693",

      acenteVkn:
        "1112223334",

      servisKod:
        "3840",

      servisVkn:
        "6360039002",

      eksperKodu:
        "2783",

      eksperVkn:
        "9876543210",

      eksperAdi:
        "Demo Eksper A",

      eksikEvrakSayisi: 3,

      eksikEvraklar: [
        "Sürücü belgesi fotokopisi",
        "Hasar fotoğrafları",
        "Banka hesap bilgisi belgesi"
      ],

      odemeList: [],

      documents: [
        {
          id: "DOC-294551-1",
          name:
            "Hasar_Dosya_Ozeti_294551.pdf",
          type: "claim_summary",
          shareable: true
        },
        {
          id: "DOC-294551-2",
          name:
            "Eksik_Evrak_Listesi_294551.pdf",
          type: "missing_documents",
          shareable: true
        }
      ]
    },

    {
      hasarDosyaNo: "294555",
      policeNo: "2000294688416",

      kaynakSistem: "PLUS",

      bransAd: "TRAFİK",

      hasarTarihi: "2026-07-05",

      hasarNeden:
        "ARACA ÇARPMA",

      dosyaDurumuAciklama:
        "EKSPER ATANDI-RAPOR BEKLENİYOR",

      dosyaIncelemeDurumu:
        "UZMAN RAPORU BEKLENİYOR",

      sigortaliMusteriAd:
        "Demo Müşteri",

      sigortaliKimlikNo:
        "11111111111",

      sigortaliDogumTarihi:
        "1990-01-01",

      sigortaliTelefon:
        "905321112233",

      sigortaliPlakaNo:
        "16AD630",

      magdurAdSoyad:
        "Demo Mağdur 2",

      magdurKimlikNo:
        "33333333333",

      magdurDogumTarihi:
        "1988-07-12",

      magdurTelefon:
        "905333334455",

      magdurPlaka:
        "34S2054",

      acenteKod:
        "7693",

      acenteVkn:
        "1112223334",

      servisKod:
        "3840",

      servisVkn:
        "6360039002",

      eksperKodu:
        "1092",

      eksperVkn:
        "1234567890",

      eksperAdi:
        "Demo Eksper B",

      eksikEvrakSayisi: 2,

      eksikEvraklar: [
        "Kaza tespit tutanağı",
        "Ruhsat fotokopisi"
      ],

      odemeList: [],

      documents: [
        {
          id: "DOC-294555-1",
          name:
            "Eksper_Bilgisi_294555.pdf",
          type: "expert_info",
          shareable: true
        }
      ]
    },

    {
      hasarDosyaNo: "294123",
      policeNo: "2000294688416",

      kaynakSistem: "PLUS",

      bransAd: "TRAFİK",

      hasarTarihi: "2026-06-18",

      hasarNeden:
        "YANDAN ÇARPMA",

      dosyaDurumuAciklama:
        "ÖDEME GÜNÜ VERİLDİ",

      dosyaIncelemeDurumu:
        "DEĞERLENDİRME TAMAMLANDI",

      sigortaliMusteriAd:
        "Demo Müşteri",

      sigortaliKimlikNo:
        "11111111111",

      sigortaliDogumTarihi:
        "1990-01-01",

      sigortaliTelefon:
        "905321112233",

      sigortaliPlakaNo:
        "16AD630",

      magdurAdSoyad:
        "Demo Mağdur",

      magdurKimlikNo:
        "22222222222",

      magdurDogumTarihi:
        "1992-02-02",

      magdurTelefon:
        "905322223344",

      magdurPlaka:
        "16CAF273",

      acenteKod:
        "7693",

      acenteVkn:
        "1112223334",

      servisKod:
        "8221",

      servisVkn:
        "4455667788",

      eksperKodu:
        "2783",

      eksperVkn:
        "9876543210",

      eksperAdi:
        "Demo Eksper A",

      eksikEvrakSayisi: 0,

      eksikEvraklar: [],

      odemeList: [
        {
          status: "PLANNED",

          plannedDate:
            "2026-10-08",

          amount: 48250,

          recipient:
            "Demo Mağdur"
        }
      ],

      documents: [
        {
          id: "DOC-294123-1",

          name:
            "Odeme_Plani_294123.pdf",

          type:
            "payment_plan",

          shareable: true
        }
      ]
    },

    {
      hasarDosyaNo: "281204",

      policeNo:
        "2000294000001",

      kaynakSistem:
        "PLUS",

      bransAd:
        "KASKO",

      hasarTarihi:
        "2026-03-15",

      hasarNeden:
        "PARK HALİNDE ÇARPMA",

      dosyaDurumuAciklama:
        "ONARIM SÜRECİ",

      dosyaIncelemeDurumu:
        "SERVİS / ONARIM TAKİBİ",

      sigortaliMusteriAd:
        "Demo Müşteri",

      sigortaliKimlikNo:
        "11111111111",

      sigortaliDogumTarihi:
        "1990-01-01",

      sigortaliTelefon:
        "905321112233",

      sigortaliPlakaNo:
        "16AD630",

      magdurAdSoyad:
        null,

      magdurKimlikNo:
        null,

      magdurDogumTarihi:
        null,

      magdurTelefon:
        null,

      magdurPlaka:
        null,

      acenteKod:
        "7693",

      acenteVkn:
        "1112223334",

      servisKod:
        "3840",

      servisVkn:
        "6360039002",

      eksperKodu:
        "4401",

      eksperVkn:
        "6677889900",

      eksperAdi:
        "Demo Eksper C",

      eksikEvrakSayisi:
        0,

      eksikEvraklar:
        [],

      odemeList:
        [],

      documents: [
        {
          id: "DOC-281204-1",

          name:
            "Onarim_Surec_Ozeti_281204.pdf",

          type:
            "repair_summary",

          shareable:
            true
        }
      ]
    },

    {
      hasarDosyaNo:
        "312870",

      policeNo:
        "2000294777000",

      kaynakSistem:
        "PLUS",

      bransAd:
        "TRAFİK",

      hasarTarihi:
        "2026-09-11",

      hasarNeden:
        "ARKADAN ÇARPMA",

      dosyaDurumuAciklama:
        "DOSYA DEĞERLENDİRMEDE",

      dosyaIncelemeDurumu:
        "UZMAN İNCELEMESİNDE",

      sigortaliMusteriAd:
        "Demo Şirket Müşterisi",

      sigortaliKimlikNo:
        null,

      sigortaliVkn:
        "9998887776",

      sigortaliDogumTarihi:
        null,

      sigortaliTelefon:
        "902121112233",

      sigortaliPlakaNo:
        "34ABC987",

      magdurAdSoyad:
        "Demo Mağdur",

      magdurKimlikNo:
        "22222222222",

      magdurDogumTarihi:
        "1992-02-02",

      magdurTelefon:
        "905322223344",

      magdurPlaka:
        "34XYZ321",

      acenteKod:
        "5412",

      acenteVkn:
        "5556667778",

      servisKod:
        "8221",

      servisVkn:
        "4455667788",

      eksperKodu:
        "1092",

      eksperVkn:
        "1234567890",

      eksperAdi:
        "Demo Eksper B",

      eksikEvrakSayisi:
        1,

      eksikEvraklar: [
        "Ruhsat fotokopisi"
      ],

      odemeList:
        [],

      documents:
        []
    }
  ]
};

const ROLE_MAP = {
  sigortali: "sigortali",
  sigortalı: "sigortali",

  magdur: "magdur",
  mağdur: "magdur",

  acente: "acente",

  servis: "servis",

  eksper: "eksper",

  avukat: "avukat",

  firma_yetkilisi:
    "firma_yetkilisi"
};

const arr = (value) => {
  if (
    value == null ||
    value === ""
  ) {
    return [];
  }

  return Array.isArray(value)
    ? value
    : [value];
};

function norm(
  field,
  value
) {
  const raw =
    String(value ?? "")
      .trim();

  if (!raw) return "";

  if (
    [
      "dosyaNo",
      "policeNo",
      "tckn",
      "vkn",
      "telefon",
      "partajNo",
      "servisKodu",
      "eksperKodu"
    ].includes(field)
  ) {
    return raw.replace(
      /\D+/g,
      ""
    );
  }

  if (
    field === "plaka"
  ) {
    return raw
      .toLocaleUpperCase(
        "tr-TR"
      )
      .replace(
        /[^0-9A-ZÇĞİÖŞÜ]/gu,
        ""
      );
  }

  if (
    field ===
    "dogumTarihi"
  ) {
    return raw
      .replace(
        /[./]/g,
        "-"
      )
      .replace(
        /\s+/g,
        ""
      );
  }

  return raw
    .toLocaleUpperCase(
      "tr-TR"
    )
    .replace(
      /\s+/g,
      ""
    );
}

function mergeEvidence(
  ...sources
) {
  const out = {};

  for (
    const source of
    sources
  ) {
    if (
      !source ||
      typeof source !==
        "object"
    ) {
      continue;
    }

    for (
      const field of
      FIELDS
    ) {
      for (
        const value of
        arr(
          source[field]
        )
      ) {
        const clean =
          norm(
            field,
            value
          );

        if (!clean) {
          continue;
        }

        if (
          !out[field]
        ) {
          out[field] = [];
        }

        if (
          !out[field]
            .includes(
              clean
            )
        ) {
          out[field]
            .push(
              clean
            );
        }
      }
    }
  }

  return out;
}

function push(
  target,
  field,
  value
) {
  if (!value) return;

  if (
    !target[field]
  ) {
    target[field] = [];
  }

  const clean =
    norm(
      field,
      value
    );

  if (
    clean &&
    !target[field]
      .includes(clean)
  ) {
    target[field]
      .push(clean);
  }
}

/*
 * AI bir entity'yi kaçırsa dahi
 * kritik alanları deterministik olarak da çıkartıyoruz.
 *
 * Böylece:
 * "Dosya 294551.
 * Plaka ya 16CAF273 ya 34S2054"
 *
 * iki plakayı da korur.
 */
function extract(
  text = ""
) {
  const upper =
    String(text)
      .toLocaleUpperCase(
        "tr-TR"
      )
      .replace(
        /[.,;:()]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      );

  const out = {};

  /*
   * Plakalar
   */
  for (
    const match of
    upper.matchAll(
      /\b\d{2}\s*[A-ZÇĞİÖŞÜ]{1,3}\s*\d{2,5}\b/gu
    )
  ) {
    push(
      out,
      "plaka",
      match[0]
    );
  }

  /*
   * Etiketli sayısal alanlar
   */
  const rules = [
    [
      "dosyaNo",
      /(?:DOSYA(?:\s+NUMARASI|\s+NO|\s+NUMARAM)?)[^0-9]{0,12}(\d[\d\s-]{4,14}\d)/giu
    ],

    [
      "policeNo",
      /(?:POL[İI]ÇE(?:\s+NUMARASI|\s+NO|\s+NUMARAM)?)[^0-9]{0,12}(\d[\d\s-]{5,20}\d)/giu
    ],

    [
      "partajNo",
      /(?:PARTAJ(?:\s+KODU|\s+NO)?)[^0-9]{0,12}(\d[\d\s-]{2,12}\d)/giu
    ],

    [
      "servisKodu",
      /(?:SERV[İI]S(?:\s+ANLAŞMA)?\s+KODU)[^0-9]{0,12}(\d[\d\s-]{2,12}\d)/giu
    ],

    [
      "eksperKodu",
      /(?:EKSPER(?:\s+ANLAŞMA)?\s+KODU)[^0-9]{0,12}(\d[\d\s-]{2,12}\d)/giu
    ],

    [
      "tckn",
      /(?:TCKN|TC\s*K[İI]ML[İI]K(?:\s+NO)?)[^0-9]{0,12}(\d[\d\s-]{9,15}\d)/giu
    ],

    [
      "vkn",
      /(?:VKN|VERG[İI]\s*K[İI]ML[İI]K(?:\s+NO)?)[^0-9]{0,12}(\d[\d\s-]{8,14}\d)/giu
    ],

    [
      "telefon",
      /(?:TELEFON|CEP(?:\s+TELEFONU)?)[^0-9]{0,12}(\d[\d\s()+-]{8,18}\d)/giu
    ]
  ];

  for (
    const [
      field,
      regex
    ] of rules
  ) {
    for (
      const match of
      upper.matchAll(
        regex
      )
    ) {
      push(
        out,
        field,
        match[1]
      );
    }
  }

  return out;
}

/*
 * Bir claim üzerinde
 * doğrulamada kullanılabilecek
 * tüm değerler.
 */
function claimValues(
  claim,
  field
) {
  const map = {
    dosyaNo: [
      claim.hasarDosyaNo
    ],

    policeNo: [
      claim.policeNo
    ],

    plaka: [
      claim.sigortaliPlakaNo,
      claim.magdurPlaka
    ],

    tckn: [
      claim.sigortaliKimlikNo,
      claim.magdurKimlikNo
    ],

    vkn: [
      claim.sigortaliVkn,
      claim.acenteVkn,
      claim.servisVkn,
      claim.eksperVkn
    ],

    dogumTarihi: [
      claim.sigortaliDogumTarihi,
      claim.magdurDogumTarihi
    ],

    telefon: [
      claim.sigortaliTelefon,
      claim.magdurTelefon
    ],

    partajNo: [
      claim.acenteKod
    ],

    servisKodu: [
      claim.servisKod
    ],

    eksperKodu: [
      claim.eksperKodu
    ]
  };

  return arr(
    map[field]
  )
    .map(
      (value) =>
        norm(
          field,
          value
        )
    )
    .filter(Boolean);
}

/*
 * V6 VERIFICATION ENGINE
 */
function verify(
  role,
  evidence
) {
  const preferredFields =
    POLICIES[role] || [
      "dosyaNo",
      "policeNo",
      "plaka",
      "tckn",
      "vkn"
    ];

  const evaluations =
    DEMO.claims.map(
      (claim) => {
        const fieldResults =
          [];

        for (
          const field of
          FIELDS
        ) {
          const candidates =
            arr(
              evidence[field]
            )
              .map(
                (value) =>
                  norm(
                    field,
                    value
                  )
              )
              .filter(
                Boolean
              );

          if (
            !candidates.length
          ) {
            continue;
          }

          const expected =
            claimValues(
              claim,
              field
            );

          const matchedValues =
            candidates.filter(
              (value) =>
                expected
                  .includes(
                    value
                  )
            );

          const rejectedValues =
            candidates.filter(
              (value) =>
                !expected
                  .includes(
                    value
                  )
            );

          fieldResults.push({
            field,

            matched:
              matchedValues
                .length > 0,

            matchedValues,

            rejectedValues
          });
        }

        /*
         * Çok önemli:
         *
         * 3 farklı plaka doğru olsa bile
         * PLATE yalnızca 1 bilgi tipi sayılır.
         *
         * 1 dosya + 1 doğru plaka
         * = 2 bağımsız evidence.
         */
        const matchedFields =
          fieldResults
            .filter(
              (x) =>
                x.matched
            )
            .map(
              (x) =>
                x.field
            );

        return {
          claimNo:
            claim.hasarDosyaNo,

          policyNo:
            claim.policeNo,

          date:
            claim.hasarTarihi,

          branch:
            claim.bransAd,

          reason:
            claim.hasarNeden,

          insuredPlate:
            claim.sigortaliPlakaNo,

          victimPlate:
            claim.magdurPlaka,

          status:
            claim.dosyaDurumuAciklama,

          matchedCount:
            new Set(
              matchedFields
            ).size,

          matchedFields,

          fieldResults
        };
      }
    );

  const verifiedClaims =
    evaluations
      .filter(
        (item) =>
          item.matchedCount >= 2
      )
      .sort(
        (a, b) =>
          b.matchedCount -
          a.matchedCount
      );

  const best =
    [...evaluations]
      .sort(
        (a, b) =>
          b.matchedCount -
          a.matchedCount
      )[0] || null;

  return {
    status:
      verifiedClaims.length
        ? "VERIFIED"
        : Object.keys(
            evidence
          ).length
        ? "IN_PROGRESS"
        : "UNVERIFIED",

    matchedCount:
      best?.matchedCount || 0,

    neededCount:
      Math.max(
        0,
        2 -
          (
            best
              ?.matchedCount ||
            0
          )
      ),

    preferredFields,

    verifiedClaims,

    bestCandidate:
      best
  };
}

function descriptor(
  claim
) {
  return {
    claimNo:
      claim.claimNo,

    policyNo:
      claim.policyNo,

    date:
      claim.date,

    branch:
      claim.branch,

    reason:
      claim.reason,

    insuredPlate:
      claim.insuredPlate,

    victimPlate:
      claim.victimPlate,

    status:
      claim.status
  };
}

function formatDate(
  iso
) {
  if (!iso) {
    return "Tarih bilinmiyor";
  }

  const [
    year,
    month,
    day
  ] = iso.split("-");

  const months = [
    "",
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık"
  ];

  return `${Number(day)} ${months[Number(month)]} ${year}`;
}

function claimCards(
  candidates
) {
  return candidates.map(
    (claim) => ({
      id:
        claim.claimNo,

      title:
        `${formatDate(claim.date)} · ${claim.branch}`,

      subtitle:
        claim.reason ||
        "Hasar dosyası",

      meta:
        `Dosya ${claim.claimNo}`,

      status:
        claim.status,

      action: {
        label:
          "Bu dosyayla devam et",

        value:
          `${claim.claimNo} numaralı dosyayla devam edelim`
      }
    })
  );
}

/*
 * Verification ortak.
 * Data sharing hâlâ rol bazlı.
 */
function canShare(
  role,
  type
) {
  if (
    role === "servis" &&
    [
      "customer_identity",
      "payment_recipient_private"
    ].includes(type)
  ) {
    return false;
  }

  if (
    role === "eksper" &&
    type ===
      "payment_recipient_private"
  ) {
    return false;
  }

  if (
    role === "magdur" &&
    type ===
      "insured_private"
  ) {
    return false;
  }

  return true;
}

function resolveClaim(
  candidates,
  reference = {}
) {
  if (
    !candidates.length
  ) {
    return {
      status: "NONE",
      candidates: []
    };
  }

  let pool =
    [...candidates];

  if (
    reference.claimNo
  ) {
    pool =
      pool.filter(
        (claim) =>
          norm(
            "dosyaNo",
            claim.claimNo
          ) ===
          norm(
            "dosyaNo",
            reference.claimNo
          )
      );
  }

  if (
    reference.plate
  ) {
    const plate =
      norm(
        "plaka",
        reference.plate
      );

    pool =
      pool.filter(
        (claim) =>
          [
            claim.insuredPlate,
            claim.victimPlate
          ].some(
            (candidate) =>
              norm(
                "plaka",
                candidate
              ) ===
              plate
          )
      );
  }

  const description =
    String(
      reference.description ||
      reference.dateText ||
      ""
    )
      .toLocaleLowerCase(
        "tr-TR"
      );

  const months = {
    ocak: "01",

    şubat: "02",
    subat: "02",

    mart: "03",

    nisan: "04",

    mayıs: "05",
    mayis: "05",

    haziran: "06",

    temmuz: "07",

    ağustos: "08",
    agustos: "08",

    eylül: "09",
    eylul: "09",

    ekim: "10",

    kasım: "11",
    kasim: "11",

    aralık: "12",
    aralik: "12"
  };

  const dateMatch =
    description.match(
      /\b(\d{1,2})\s+(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)(?:\s+(\d{4}))?/i
    );

  if (
    dateMatch
  ) {
    const day =
      String(
        dateMatch[1]
      ).padStart(
        2,
        "0"
      );

    const month =
      months[
        dateMatch[2]
      ];

    const year =
      dateMatch[3] ||
      null;

    pool =
      pool.filter(
        (claim) => {
          const [
            y,
            m,
            d
          ] =
            String(
              claim.date ||
              ""
            ).split(
              "-"
            );

          return (
            d === day &&
            m === month &&
            (
              !year ||
              y === year
            )
          );
        }
      );
  } else {
    for (
      const [
        name,
        month
      ] of Object.entries(
        months
      )
    ) {
      if (
        description.includes(
          name
        )
      ) {
        pool =
          pool.filter(
            (claim) =>
              String(
                claim.date
              ).includes(
                `-${month}-`
              )
          );
      }
    }
  }

  if (
    description.includes(
      "kasko"
    )
  ) {
    pool =
      pool.filter(
        (claim) =>
          claim.branch ===
          "KASKO"
      );
  }

  if (
    description.includes(
      "trafik"
    )
  ) {
    pool =
      pool.filter(
        (claim) =>
          claim.branch ===
          "TRAFİK"
      );
  }

  if (
    reference.ordinal ===
    "first"
  ) {
    pool =
      pool.slice(
        0,
        1
      );
  }

  if (
    reference.ordinal ===
    "last"
  ) {
    pool =
      pool.slice(
        -1
      );
  }

  if (
    pool.length === 1
  ) {
    return {
      status:
        "RESOLVED",

      claim:
        pool[0],

      candidates:
        pool
    };
  }

  if (
    pool.length > 1
  ) {
    return {
      status:
        "AMBIGUOUS",

      candidates:
        pool
    };
  }

  return {
    status:
      "NO_MATCH",

    candidates
  };
}

function claimByNo(
  claimNo
) {
  return (
    DEMO.claims.find(
      (claim) =>
        norm(
          "dosyaNo",
          claim.hasarDosyaNo
        ) ===
        norm(
          "dosyaNo",
          claimNo
        )
    ) ||
    null
  );
}

export function blankSession() {
  return {
    role: null,

    verification: {
      status:
        "UNVERIFIED",

      evidenceCandidates:
        {},

      matchedCount:
        0,

      neededCount:
        2,

      verifiedClaims:
        [],

      bestCandidate:
        null,

      unavailableFields:
        [],

      history:
        []
    },

    activeClaimNo:
      null,

    candidateClaims:
      [],

    activePolicyNo:
      null,

    activeIntents:
      [],

    uploadedFiles:
      [],

    turnCount:
      0,

    lastToolResult:
      null
  };
}

function cloneSession(
  input
) {
  const base =
    blankSession();

  return {
    ...base,

    ...(input || {}),

    verification: {
      ...base.verification,

      ...(input
        ?.verification ||
        {}),

      evidenceCandidates:
        structuredClone(
          input
            ?.verification
            ?.evidenceCandidates ||
            {}
        ),

      verifiedClaims: [
        ...(
          input
            ?.verification
            ?.verifiedClaims ||
          []
        )
      ],

      unavailableFields: [
        ...(
          input
            ?.verification
            ?.unavailableFields ||
          []
        )
      ],

      history: [
        ...(
          input
            ?.verification
            ?.history ||
          []
        )
      ]
    },

    candidateClaims: [
      ...(
        input
          ?.candidateClaims ||
        []
      )
    ],

    activeIntents: [
      ...(
        input
          ?.activeIntents ||
        []
      )
    ],

    uploadedFiles: [
      ...(
        input
          ?.uploadedFiles ||
        []
      )
    ]
  };
}

function evidenceQuickActions(
  role,
  session
) {
  const used =
    new Set(
      Object.keys(
        session
          .verification
          .evidenceCandidates ||
        {}
      )
    );

  const unavailable =
    new Set(
      session
        .verification
        .unavailableFields ||
      []
    );

  const labels = {
    partajNo:
      "Partaj kodu",

    servisKodu:
      "Servis anlaşma kodu",

    eksperKodu:
      "Eksper anlaşma kodu",

    dosyaNo:
      "Dosya numarası",

    policeNo:
      "Poliçe numarası",

    plaka:
      "Plaka",

    tckn:
      "TCKN",

    vkn:
      "VKN",

    dogumTarihi:
      "Doğum tarihi",

    telefon:
      "Telefon"
  };

  return (
    POLICIES[role] ||
    []
  )
    .filter(
      (field) =>
        !used.has(
          field
        ) &&
        !unavailable.has(
          field
        )
    )
    .slice(
      0,
      4
    )
    .map(
      (field) => ({
        label:
          labels[field] ||
          field,

        value:
          `Doğrulama için ${labels[field] || field} bilgisiyle ilerleyelim`,

        field
      })
    );
}

export function applyV6Turn({
  plan,

  currentSession,

  latestUserText = "",

  uploadedFiles = []
}) {
  const session =
    cloneSession(
      currentSession
    );

  session.turnCount += 1;

  const toolTrace =
    [];

  const toolContext =
    [];

  let quickActions =
    [];

  let cards =
    [];

  let documentCards =
    [];

  if (
    plan.dialogueAct ===
    "restart"
  ) {
    return {
      session:
        blankSession(),

      toolTrace,

      toolContext: [
        {
          type: "state",
          result:
            "RESTARTED"
        }
      ],

      ui: {
        quickActions:
          ROLE_OPTIONS,

        claimCards:
          [],

        documentCards:
          [],

        verification:
          null
      },

      verificationNext: {
        state:
          "ROLE_REQUIRED"
      }
    };
  }

  if (
    Array.isArray(
      plan.intents
    ) &&
    plan.intents.length
  ) {
    session.activeIntents =
      [
        ...new Set(
          plan.intents
        )
      ];
  }

  if (
    plan.roleCandidate
  ) {
    session.role =
      ROLE_MAP[
        plan.roleCandidate
      ] ||
      plan.roleCandidate;
  }

  if (
    Array.isArray(
      plan.unavailableFields
    )
  ) {
    for (
      const field of
      plan.unavailableFields
    ) {
      if (
        !session
          .verification
          .unavailableFields
          .includes(
            field
          )
      ) {
        session
          .verification
          .unavailableFields
          .push(
            field
          );
      }
    }
  }

  /*
   * AI extracted entities
   * +
   * deterministic extraction
   *
   * beraber tutulur.
   */
  const turnEvidence =
    mergeEvidence(
      extract(
        latestUserText
      ),

      plan
        .providedCandidates ||
      {},

      plan.provided ||
      {}
    );

  session
    .verification
    .evidenceCandidates =
      mergeEvidence(
        session
          .verification
          .evidenceCandidates,

        turnEvidence
      );

  /*
   * Düzeltme:
   * eski adaylar bu field
   * için değiştirilir.
   */
  if (
    plan.dialogueAct ===
      "correct_info" &&
    plan.correction
      ?.field
  ) {
    const field =
      plan.correction
        .field;

    const replacement =
      plan.correction
        ?.newValues
        ?.length
        ? plan
            .correction
            .newValues
        : plan
            .correction
            ?.newValue
        ? [
            plan
              .correction
              .newValue
          ]
        : [];

    session
      .verification
      .evidenceCandidates[
        field
      ] =
        replacement
          .map(
            (value) =>
              norm(
                field,
                value
              )
          )
          .filter(
            Boolean
          );
  }

  /*
   * UI'dan yüklenen dosyalar.
   */
  for (
    const file of
    uploadedFiles || []
  ) {
    if (
      !session
        .uploadedFiles
        .some(
          (item) =>
            item.id ===
            file.id
        )
    ) {
      session
        .uploadedFiles
        .push(
          file
        );
    }
  }

  let verification =
    null;

  if (
    !session.role
  ) {
    quickActions =
      ROLE_OPTIONS;
  } else {
    verification =
      verify(
        session.role,

        session
          .verification
          .evidenceCandidates
      );

    session
      .verification
      .status =
        verification
          .status;

    session
      .verification
      .matchedCount =
        verification
          .matchedCount;

    session
      .verification
      .neededCount =
        verification
          .neededCount;

    session
      .verification
      .verifiedClaims =
        verification
          .verifiedClaims;

    session
      .verification
      .bestCandidate =
        verification
          .bestCandidate;

    toolTrace.push({
      name:
        "verify_evidence_bundle",

      result: {
        status:
          verification
            .status,

        matchedCount:
          verification
            .matchedCount,

        verifiedClaimCount:
          verification
            .verifiedClaims
            .length
      }
    });

    toolContext.push({
      type:
        "verification",

      result:
        verification
    });

    if (
      verification
        .status !==
      "VERIFIED"
    ) {
      quickActions =
        evidenceQuickActions(
          session.role,

          session
        );
    }
  }

  const verified =
    session
      .verification
      .status ===
    "VERIFIED";

  /*
   * Doğrulama ile
   * dosya seçimi AYRI.
   */
  if (
    verified
  ) {
    session
      .candidateClaims =
        verification
          .verifiedClaims
          .map(
            descriptor
          );

    toolContext.push({
      type:
        "claim_candidates",

      result:
        session
          .candidateClaims
    });

    const reference =
      plan
        .claimReference ||
      {};

    const shouldResolve =
      Boolean(
        reference.claimNo ||
        reference.plate ||
        reference.dateText ||
        reference.description ||
        reference.ordinal ||
        reference.switchClaim ||
        plan.dialogueAct ===
          "change_claim"
      );

    if (
      shouldResolve
    ) {
      const resolved =
        resolveClaim(
          session
            .candidateClaims,

          reference
        );

      toolContext.push({
        type:
          "claim_resolution",

        result:
          resolved
      });

      if (
        resolved.status ===
        "RESOLVED"
      ) {
        session
          .activeClaimNo =
            resolved
              .claim
              .claimNo;
      }

      if (
        resolved.status ===
        "AMBIGUOUS"
      ) {
        cards =
          claimCards(
            resolved
              .candidates
          );
      }
    } else if (
      !session
        .activeClaimNo &&
      session
        .candidateClaims
        .length === 1
    ) {
      session
        .activeClaimNo =
          session
            .candidateClaims[0]
            .claimNo;
    } else if (
      !session
        .activeClaimNo &&
      session
        .candidateClaims
        .length > 1
    ) {
      cards =
        claimCards(
          session
            .candidateClaims
        );
    }
  }

  const wantsClaim =
    session
      .activeIntents
      .some(
        (intent) =>
          [
            "claim_status",
            "payment",
            "documents",
            "expert",
            "service",
            "policy"
          ].includes(
            intent
          )
      );

  if (
    verified &&
    wantsClaim &&
    session
      .activeClaimNo
  ) {
    const claim =
      claimByNo(
        session
          .activeClaimNo
      );

    if (claim) {
      session
        .activePolicyNo =
          claim
            .policeNo;

      const safe =
        structuredClone(
          claim
        );

      if (
        session.role ===
        "servis"
      ) {
        delete safe
          .sigortaliKimlikNo;

        delete safe
          .magdurKimlikNo;

        delete safe
          .sigortaliDogumTarihi;

        delete safe
          .magdurDogumTarihi;

        delete safe
          .odemeList;
      }

      if (
        session.role ===
        "magdur"
      ) {
        delete safe
          .sigortaliKimlikNo;

        delete safe
          .sigortaliDogumTarihi;
      }

      toolContext.push({
        type:
          "claim_data",

        result: {
          ok: true,

          claim:
            safe
        }
      });

      /*
       * AI -> customer
       * document cards.
       */
      if (
        session
          .activeIntents
          .includes(
            "documents"
          ) &&
        canShare(
          session.role,
          "document"
        )
      ) {
        documentCards =
          (
            claim.documents ||
            []
          )
            .filter(
              (document) =>
                document
                  .shareable
            )
            .map(
              (document) => ({
                ...document,

                claimNo:
                  claim
                    .hasarDosyaNo,

                label:
                  document
                    .name,

                action: {
                  label:
                    "Dosyayı aç",

                  value:
                    document.id
                }
              })
            );

        toolContext.push({
          type:
            "shareable_documents",

          result: {
            ok: true,

            documents:
              documentCards
          }
        });
      }
    }
  }

  const best =
    verification
      ?.bestCandidate;

  /*
   * UI verification card.
   */
  const verificationUI =
    verification
      ? {
          status:
            verification
              .status,

          matchedCount:
            verification
              .matchedCount,

          neededCount:
            verification
              .neededCount,

          matchedFields:
            best
              ?.fieldResults
              ?.filter(
                (item) =>
                  item.matched
              )
              .map(
                (item) =>
                  item.field
              ) ||
            [],

          /*
           * Bunlar sadece diagnostic.
           *
           * Bir rejected candidate
           * verification'ı otomatik
           * fail ETMEZ.
           */
          rejectedCandidates:
            best
              ?.fieldResults
              ?.flatMap(
                (item) =>
                  (
                    item
                      .rejectedValues ||
                    []
                  ).map(
                    (value) => ({
                      field:
                        item.field,

                      value
                    })
                  )
              ) ||
            []
        }
      : null;

  session.lastToolResult =
    toolContext.at(-1) ||
    null;

  return {
    session,

    toolTrace,

    toolContext,

    ui: {
      quickActions,

      claimCards:
        cards,

      documentCards,

      verification:
        verificationUI,

      uploadedFiles:
        session
          .uploadedFiles
    },

    verificationNext:
      session.role
        ? {
            state:
              verified
                ? "VERIFIED"
                : "NEED_MORE_EVIDENCE",

            matchedCount:
              session
                .verification
                .matchedCount,

            neededCount:
              session
                .verification
                .neededCount,

            preferredFields:
              POLICIES[
                session.role
              ] ||
              []
          }
        : {
            state:
              "ROLE_REQUIRED"
          }
  };
}
