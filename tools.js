import { DEMO } from "./mockData";
import { canShare, VERIFICATION_POLICIES } from "./policy";

const norm = (v) => String(v ?? "").replace(/\s+/g, "").toLocaleUpperCase("tr-TR");
const asArray = (v) => Array.isArray(v) ? v : [v];
const match = (a, b) => asArray(b).some((x) => Boolean(norm(a)) && norm(a) === norm(x));

export function profileForRole(role) {
  return DEMO.verificationProfiles[role] || null;
}

export function verifyField({ role, field, value }) {
  const profile = profileForRole(role);
  if (!profile) return { ok: false, reason: "PROFILE_NOT_FOUND", field };
  if (!(field in profile)) return { ok: false, reason: "FIELD_NOT_ALLOWED_FOR_ROLE", field };
  return { ok: match(value, profile[field]), field };
}

export function lookupByIdentifier({ field, value }) {
  const candidates = [];
  for (const [role, profile] of Object.entries(DEMO.verificationProfiles)) {
    if (field in profile && match(value, profile[field])) candidates.push({ role });
  }
  return { found: candidates.length > 0, count: candidates.length, candidates };
}

export function getVerificationPolicy(role) {
  return VERIFICATION_POLICIES[role] || null;
}

function claimAuthorizedForRole(claim, role) {
  if (role === "sigortali") return claim.sigortaliKimlikNo === DEMO.verificationProfiles.sigortali.tckn;
  if (role === "magdur") return claim.magdurKimlikNo === DEMO.verificationProfiles.magdur.tckn;
  if (role === "acente") return claim.acenteKod === DEMO.verificationProfiles.acente.partajNo;
  if (role === "servis") return claim.servisKod === DEMO.verificationProfiles.servis.servisKodu;
  return false;
}

function safeDescriptor(claim) {
  return {
    claimNo: claim.hasarDosyaNo,
    date: claim.hasarTarihi,
    branch: claim.bransAd,
    reason: claim.hasarNeden,
    plate: claim.sigortaliPlakaNo
  };
}

export function findCandidateClaims({ role, verified, evidence = {} }) {
  if (!verified) return { ok: false, reason: "IDENTITY_NOT_VERIFIED", candidates: [] };

  let claims = DEMO.claims.filter((c) => claimAuthorizedForRole(c, role));

  if (evidence.dosyaNo) claims = claims.filter((c) => match(evidence.dosyaNo, c.hasarDosyaNo));
  if (evidence.policeNo) claims = claims.filter((c) => match(evidence.policeNo, c.policeNo));
  if (evidence.plaka) {
    claims = claims.filter((c) =>
      match(evidence.plaka, c.sigortaliPlakaNo) || match(evidence.plaka, c.magdurPlaka)
    );
  }

  return { ok: true, candidates: claims.map(safeDescriptor) };
}

function parseDateText(text = "") {
  const t = String(text).toLocaleLowerCase("tr-TR");
  const months = {
    ocak: "01", şubat: "02", subat: "02", mart: "03", nisan: "04", mayıs: "05", mayis: "05",
    haziran: "06", temmuz: "07", ağustos: "08", agustos: "08", eylül: "09", eylul: "09",
    ekim: "10", kasım: "11", kasim: "11", aralık: "12", aralik: "12"
  };
  const m = t.match(/\b(\d{1,2})\s+(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)(?:\s+(\d{4}))?/i);
  if (!m) return null;
  return { day: String(m[1]).padStart(2, "0"), month: months[m[2]], year: m[3] || null };
}

export function resolveClaimReference({ candidates = [], reference = {} }) {
  if (!candidates.length) return { status: "NONE", candidates: [] };

  let pool = [...candidates];

  if (reference.claimNo) pool = pool.filter((c) => match(reference.claimNo, c.claimNo));
  if (reference.plate) pool = pool.filter((c) => match(reference.plate, c.plate));

  const date = parseDateText(reference.dateText || reference.description || "");
  if (date) {
    pool = pool.filter((c) => {
      const [y, m, d] = String(c.date || "").split("-");
      return d === date.day && m === date.month && (!date.year || y === date.year);
    });
  }

  const desc = String(reference.description || "").toLocaleLowerCase("tr-TR");
  if (desc.includes("mart")) pool = pool.filter((c) => String(c.date).includes("-03-"));
  if (desc.includes("temmuz")) pool = pool.filter((c) => String(c.date).includes("-07-"));
  if (desc.includes("kasko")) pool = pool.filter((c) => c.branch === "KASKO");
  if (desc.includes("trafik")) pool = pool.filter((c) => c.branch === "TRAFİK");

  if (reference.ordinal === "first") pool = pool.slice(0, 1);
  if (reference.ordinal === "last") pool = pool.slice(-1);

  if (pool.length === 1) return { status: "RESOLVED", claim: pool[0], candidates: pool };
  if (pool.length > 1) return { status: "AMBIGUOUS", candidates: pool };
  return { status: "NO_MATCH", candidates };
}

export function getClaim({ claimNo, role, verified }) {
  if (!verified) return { ok: false, reason: "IDENTITY_NOT_VERIFIED" };
  const claim = DEMO.claims.find((c) => match(claimNo, c.hasarDosyaNo));
  if (!claim) return { ok: false, reason: "CLAIM_NOT_FOUND" };
  if (!claimAuthorizedForRole(claim, role)) return { ok: false, reason: "ROLE_NOT_AUTHORIZED" };

  const share = canShare({ role, verified, dataType: "claim" });
  if (share.decision !== "ALLOW") return { ok: false, reason: share.reason };

  const result = structuredClone(claim);
  if (role === "servis") {
    delete result.sigortaliMusteriAd;
    delete result.sigortaliKimlikNo;
    delete result.magdurKimlikNo;
  }
  if (role === "magdur") delete result.sigortaliKimlikNo;
  return { ok: true, claim: result };
}

export function getPolicy({ policyNo, role, verified }) {
  if (!verified) return { ok: false, reason: "IDENTITY_NOT_VERIFIED" };
  const policy = DEMO.policies.find((p) => match(policyNo, p.policeNo));
  if (!policy) return { ok: false, reason: "POLICY_NOT_FOUND" };
  return { ok: true, policy: structuredClone(policy) };
}
