import { DEMO } from "./mockData";
import { canShare, VERIFICATION_POLICIES } from "./policy";

const norm = (v) => String(v ?? "").replace(/\s+/g, "").toUpperCase();

function match(a, b) {
  return Boolean(norm(a)) && norm(a) === norm(b);
}

export function profileForRole(role) {
  return DEMO.verificationProfiles[role] || null;
}

export function verifyField({ role, field, value }) {
  const profile = profileForRole(role);
  if (!profile) return { ok: false, reason: "PROFILE_NOT_FOUND" };

  if (field === "servisKodu") return { ok: match(value, profile.servisKodu), field };
  if (field === "vkn") return { ok: match(value, profile.vkn), field };
  if (field === "tckn") return { ok: match(value, profile.tckn), field };
  if (field === "partajNo") return { ok: match(value, profile.partajNo), field };
  if (field === "dosyaNo") return { ok: match(value, profile.dosyaNo), field };
  if (field === "policeNo") return { ok: match(value, profile.policeNo), field };
  if (field === "plaka") return { ok: match(value, profile.plaka), field };
  if (field === "dogumTarihi") return { ok: match(value, profile.dogumTarihi), field };

  return { ok: false, reason: "UNKNOWN_FIELD", field };
}

export function lookupByIdentifier({ field, value }) {
  const candidates = [];
  for (const [role, profile] of Object.entries(DEMO.verificationProfiles)) {
    if (profile[field] && match(value, profile[field])) candidates.push({ role, profile });
  }
  return { found: candidates.length > 0, count: candidates.length, candidates };
}

export function getVerificationPolicy(role) {
  return VERIFICATION_POLICIES[role] || null;
}

export function getClaim({ claimNo, role, verified }) {
  if (!verified) return { ok: false, reason: "IDENTITY_NOT_VERIFIED" };
  if (!match(claimNo, DEMO.claim.hasarDosyaNo)) return { ok: false, reason: "CLAIM_NOT_FOUND" };

  const share = canShare({ role, verified, dataType: "claim" });
  if (share.decision !== "ALLOW") return { ok: false, reason: share.reason };

  const claim = structuredClone(DEMO.claim);
  if (role === "servis") {
    delete claim.sigortaliMusteriAd;
    delete claim.sigortaliKimlikNo;
    delete claim.magdurKimlikNo;
  }
  if (role === "magdur") {
    delete claim.sigortaliKimlikNo;
  }
  return { ok: true, claim };
}

export function getPolicy({ policyNo, role, verified }) {
  if (!verified) return { ok: false, reason: "IDENTITY_NOT_VERIFIED" };
  if (!match(policyNo, DEMO.policy.policeNo)) return { ok: false, reason: "POLICY_NOT_FOUND" };
  const policy = structuredClone(DEMO.policy);
  return { ok: true, policy };
}

export function getCustomer({ role, verified }) {
  if (!verified) return { ok: false, reason: "IDENTITY_NOT_VERIFIED" };
  const share = canShare({ role, verified, dataType: "customer_identity" });
  if (share.decision !== "ALLOW") return { ok: false, reason: share.reason };
  return { ok: true, customer: structuredClone(DEMO.customer) };
}
