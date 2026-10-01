import { ROLE_OPTIONS, VERIFICATION_POLICIES } from "./policy";
import {
  findCandidateClaims,
  getClaim,
  getPolicy,
  lookupByIdentifier,
  resolveClaimReference,
  verifyField
} from "./tools";

const ROLE_MAP = {
  sigortali: "sigortali", sigortalı: "sigortali",
  magdur: "magdur", mağdur: "magdur",
  acente: "acente", servis: "servis", avukat: "avukat",
  firma_yetkilisi: "firma_yetkilisi"
};

export function blankSession() {
  return {
    role: null,
    verification: {
      status: "UNVERIFIED",
      verifiedFields: {},
      rejectedFields: {},
      unavailableFields: [],
      history: []
    },
    activeClaimNo: null,
    candidateClaims: [],
    activePolicyNo: null,
    activeIntents: [],
    turnCount: 0,
    deadEndCount: 0,
    lastQuestionKey: null,
    lastToolResult: null
  };
}

function cloneSession(input) {
  const base = blankSession();
  return {
    ...base,
    ...(input || {}),
    verification: {
      ...base.verification,
      ...(input?.verification || {}),
      verifiedFields: { ...(input?.verification?.verifiedFields || {}) },
      rejectedFields: { ...(input?.verification?.rejectedFields || {}) },
      unavailableFields: [...(input?.verification?.unavailableFields || [])],
      history: [...(input?.verification?.history || [])]
    },
    candidateClaims: [...(input?.candidateClaims || [])],
    activeIntents: [...(input?.activeIntents || [])]
  };
}

function invalidateDownstream(session, fromField) {
  const identityRoots = ["role", "tckn", "vkn", "servisKodu", "partajNo", "dogumTarihi", "plaka", "policeNo"];
  if (identityRoots.includes(fromField)) {
    session.activeClaimNo = null;
    session.candidateClaims = [];
    if (fromField !== "policeNo") session.activePolicyNo = null;
  }
  session.verification.status = "IN_PROGRESS";
}

function setRole(session, role) {
  const normalized = ROLE_MAP[role] || role;
  if (normalized && normalized !== session.role) {
    session.verification.history.push({ event: "ROLE_CHANGED", from: session.role, to: normalized });
    session.role = normalized;
    session.verification.verifiedFields = {};
    session.verification.rejectedFields = {};
    session.verification.unavailableFields = [];
    session.verification.status = "IN_PROGRESS";
    session.activeClaimNo = null;
    session.candidateClaims = [];
    session.activePolicyNo = null;
    session.deadEndCount = 0;
  }
}

function verifyOne(session, field, value, toolTrace, toolContext) {
  if (!session.role) return { ok: false, reason: "ROLE_REQUIRED" };
  const policy = VERIFICATION_POLICIES[session.role];
  if (!policy || policy.manual) return { ok: false, reason: "MANUAL_POLICY" };
  if (!policy.allowedFields.includes(field)) {
    return { ok: false, reason: "FIELD_NOT_ALLOWED_FOR_ROLE" };
  }

  const result = verifyField({ role: session.role, field, value });
  toolTrace.push({ name: "verify_field", input: { field }, result: { ok: result.ok, reason: result.reason || null } });

  if (result.ok) {
    session.verification.verifiedFields[field] = value;
    delete session.verification.rejectedFields[field];
    session.verification.unavailableFields = session.verification.unavailableFields.filter((x) => x !== field);
    session.verification.history.push({ event: "FIELD_VERIFIED", field });
    toolContext.push({ type: "verification", field, result: "MATCH" });
  } else {
    session.verification.rejectedFields[field] = value;
    session.verification.history.push({ event: "FIELD_REJECTED", field });
    session.deadEndCount += 1;
    toolContext.push({ type: "verification", field, result: "NO_MATCH" });
  }
  return result;
}

function policySatisfied(session) {
  const p = VERIFICATION_POLICIES[session.role];
  if (!p || p.manual) return false;
  const vf = session.verification.verifiedFields;
  const matchedAllowed = p.allowedFields.filter((f) => vf[f]);
  return matchedAllowed.length >= p.minMatches;
}

function verificationNext(session) {
  if (!session.role) {
    return { state: "ROLE_REQUIRED", quickActions: ROLE_OPTIONS, suggestions: [] };
  }
  const p = VERIFICATION_POLICIES[session.role];
  if (!p) return { state: "ROLE_UNSUPPORTED", quickActions: [], suggestions: [] };
  if (p.manual) return { state: "MANUAL_REQUIRED", quickActions: [], reason: p.reason, suggestions: [] };
  if (policySatisfied(session)) return { state: "VERIFIED", quickActions: [], suggestions: [] };

  const vf = session.verification.verifiedFields;
  const unavailable = new Set(session.verification.unavailableFields);
  const remaining = p.preferredFields.filter((f) => !vf[f] && !unavailable.has(f));
  const matchedCount = p.allowedFields.filter((f) => vf[f]).length;
  const neededCount = Math.max(0, p.minMatches - matchedCount);

  return {
    state: session.deadEndCount >= 2 ? "VERIFICATION_DEAD_END" : "NEED_MORE_EVIDENCE",
    matchedCount,
    neededCount,
    suggestions: remaining,
    quickActions: []
  };
}

function makeClaimActions(candidates) {
  return candidates.slice(0, 4).map((c) => ({
    label: `${formatDate(c.date)} · ${c.branch}`,
    value: `${c.date} tarihli ${c.branch.toLocaleLowerCase("tr-TR")} dosyasını kastediyorum`
  }));
}

function formatDate(iso) {
  if (!iso) return "Tarih bilinmiyor";
  const [y, m, d] = iso.split("-");
  const months = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  return `${Number(d)} ${months[Number(m)]} ${y}`;
}

export function applyPlan({ plan, currentSession }) {
  const session = cloneSession(currentSession);
  session.turnCount += 1;
  const toolTrace = [];
  const toolContext = [];
  let quickActions = [];

  if (Array.isArray(plan.intents) && plan.intents.length) {
    session.activeIntents = [...new Set(plan.intents)];
  }

  if (plan.dialogueAct === "restart") {
    return {
      session: blankSession(), toolTrace,
      toolContext: [{ type: "state", result: "RESTARTED" }],
      ui: { quickActions: [] },
      verificationNext: { state: "ROLE_REQUIRED", quickActions: ROLE_OPTIONS }
    };
  }

  if (plan.roleCandidate) setRole(session, plan.roleCandidate);

  if (Array.isArray(plan.unavailableFields)) {
    for (const field of plan.unavailableFields) {
      if (!session.verification.unavailableFields.includes(field)) {
        session.verification.unavailableFields.push(field);
      }
      // Kullanıcı önce yanlış bir değer verip sonra bu bilgiye erişimi olmadığını söylüyorsa
      // alternatif doğrulama yolunu kilitlememek için o alanın eski red kaydını aktif çatışma saymayız.
      delete session.verification.rejectedFields[field];
      session.verification.history.push({ event: "FIELD_UNAVAILABLE", field });
      toolContext.push({ type: "availability", field, result: "USER_DOES_NOT_HAVE" });
    }
  }

  if ((plan.dialogueAct === "correct_info" || plan.dialogueAct === "retract_info") && plan.correction?.field) {
    const field = plan.correction.field;
    invalidateDownstream(session, field);
    delete session.verification.verifiedFields[field];
    delete session.verification.rejectedFields[field];
    session.verification.history.push({ event: "FIELD_INVALIDATED_BY_USER", field });
    toolContext.push({ type: "correction", field, result: "PREVIOUS_VALUE_INVALIDATED" });
  }

  if (plan.dialogueAct === "change_role" && plan.roleCandidate) setRole(session, plan.roleCandidate);

  const provided = { ...(plan.provided || {}) };
  if (plan.correction?.field && plan.correction?.newValue) {
    provided[plan.correction.field] = plan.correction.newValue;
  }

  const orderedFields = ["tckn", "vkn", "servisKodu", "partajNo", "dogumTarihi", "plaka", "dosyaNo", "policeNo"];
  for (const field of orderedFields) {
    const value = provided[field];
    if (!value) continue;

    if (!session.role) {
      const lookup = lookupByIdentifier({ field, value });
      toolTrace.push({ name: "lookup_by_identifier", input: { field }, result: { found: lookup.found, count: lookup.count } });
      toolContext.push({ type: "identifier_lookup", field, result: lookup.found ? "FOUND_BUT_ROLE_REQUIRED" : "NOT_FOUND" });
      continue;
    }

    verifyOne(session, field, value, toolTrace, toolContext);
    if (session.verification.verifiedFields.policeNo) session.activePolicyNo = session.verification.verifiedFields.policeNo;
  }

  const policy = session.role ? VERIFICATION_POLICIES[session.role] : null;
  if (policy?.manual) {
    session.verification.status = "NEEDS_AGENT";
    toolContext.push({ type: "policy", result: "MANUAL_VERIFICATION_REQUIRED", reason: policy.reason });
  } else if (session.role && policySatisfied(session)) {
    session.verification.status = "VERIFIED";
    session.deadEndCount = 0;
  } else {
    session.verification.status = session.role ? "IN_PROGRESS" : "UNVERIFIED";
  }

  const next = verificationNext(session);
  if (!session.role) quickActions = ROLE_OPTIONS;

  const verified = session.verification.status === "VERIFIED";
  const wantsClaimData = session.activeIntents.some((x) => ["claim_status", "payment", "documents", "expert", "service"].includes(x));

  if (verified) {
    const evidence = session.verification.verifiedFields;
    const candidatesResult = findCandidateClaims({ role: session.role, verified, evidence });
    toolTrace.push({ name: "find_candidate_claims", input: { evidenceFields: Object.keys(evidence) }, result: { ok: candidatesResult.ok, count: candidatesResult.candidates?.length || 0 } });

    if (candidatesResult.ok) {
      session.candidateClaims = candidatesResult.candidates;
      toolContext.push({ type: "claim_candidates", result: candidatesResult.candidates });

      const reference = plan.claimReference || {};
      const shouldResolve = Boolean(
        reference.claimNo || reference.plate || reference.dateText || reference.description ||
        reference.ordinal || reference.switchClaim || plan.dialogueAct === "change_claim"
      );

      if (shouldResolve) {
        const resolved = resolveClaimReference({ candidates: session.candidateClaims, reference });
        toolTrace.push({ name: "resolve_claim_reference", input: reference, result: { status: resolved.status, count: resolved.candidates?.length || 0 } });
        toolContext.push({ type: "claim_resolution", result: resolved });
        if (resolved.status === "RESOLVED") session.activeClaimNo = resolved.claim.claimNo;
        if (resolved.status === "AMBIGUOUS") quickActions = makeClaimActions(resolved.candidates);
      } else if (!session.activeClaimNo && session.candidateClaims.length === 1) {
        session.activeClaimNo = session.candidateClaims[0].claimNo;
        toolContext.push({ type: "claim_resolution", result: { status: "AUTO_RESOLVED", claim: session.candidateClaims[0] } });
      } else if (!session.activeClaimNo && session.candidateClaims.length > 1 && wantsClaimData) {
        toolContext.push({ type: "claim_resolution", result: { status: "AMBIGUOUS", candidates: session.candidateClaims } });
        quickActions = makeClaimActions(session.candidateClaims);
      }
    }
  }

  if (verified && wantsClaimData && session.activeClaimNo) {
    const claimResult = getClaim({ claimNo: session.activeClaimNo, role: session.role, verified });
    toolTrace.push({ name: "get_claim", input: { claimNo: session.activeClaimNo }, result: { ok: claimResult.ok, reason: claimResult.reason || null } });
    toolContext.push({ type: "claim_data", result: claimResult });
  }

  if (verified && session.activeIntents.includes("policy") && session.activePolicyNo) {
    const policyResult = getPolicy({ policyNo: session.activePolicyNo, role: session.role, verified });
    toolTrace.push({ name: "get_policy", input: { policyNo: session.activePolicyNo }, result: { ok: policyResult.ok, reason: policyResult.reason || null } });
    toolContext.push({ type: "policy_data", result: policyResult });
  }

  session.lastToolResult = toolContext.at(-1) || null;

  return {
    session,
    toolTrace,
    toolContext,
    ui: { quickActions },
    verificationNext: next
  };
}
