import { ROLE_OPTIONS, VERIFICATION_POLICIES } from "./policy";
import { getClaim, getPolicy, lookupByIdentifier, verifyField } from "./tools";

const ROLE_MAP = {
  sigortali: "sigortali", sigortalı: "sigortali",
  magdur: "magdur", mağdur: "magdur",
  acente: "acente", servis: "servis", avukat: "avukat",
  firma_yetkilisi: "firma_yetkilisi"
};

export function blankSession() {
  return {
    role: null,
    verification: { status: "UNVERIFIED", verifiedFields: {}, rejectedFields: {}, history: [] },
    activeClaimNo: null,
    activePolicyNo: null,
    activeIntents: [],
    lastToolResult: null
  };
}

function cloneSession(input) {
  return {
    ...blankSession(),
    ...(input || {}),
    verification: {
      ...blankSession().verification,
      ...(input?.verification || {}),
      verifiedFields: { ...(input?.verification?.verifiedFields || {}) },
      rejectedFields: { ...(input?.verification?.rejectedFields || {}) },
      history: [...(input?.verification?.history || [])]
    }
  };
}

function invalidateDownstream(session, fromField) {
  const sensitiveRoots = ["role", "tckn", "vkn", "servisKodu", "partajNo", "dogumTarihi", "plaka"];
  if (sensitiveRoots.includes(fromField)) {
    session.activeClaimNo = null;
    session.activePolicyNo = null;
    session.verification.status = "UNVERIFIED";
    for (const key of ["dosyaNo", "policeNo"]) delete session.verification.verifiedFields[key];
  }
}

function setRole(session, role) {
  const normalized = ROLE_MAP[role] || role;
  if (normalized && normalized !== session.role) {
    session.verification.history.push({ event: "ROLE_CHANGED", from: session.role, to: normalized });
    session.role = normalized;
    session.verification.verifiedFields = {};
    session.verification.rejectedFields = {};
    session.verification.status = "UNVERIFIED";
    session.activeClaimNo = null;
    session.activePolicyNo = null;
  }
}

function verifyOne(session, field, value, toolTrace) {
  if (!session.role) return { ok: false, reason: "ROLE_REQUIRED" };
  const result = verifyField({ role: session.role, field, value });
  toolTrace.push({ name: "verify_field", input: { field }, result: { ok: result.ok, reason: result.reason || null } });

  if (result.ok) {
    session.verification.verifiedFields[field] = value;
    delete session.verification.rejectedFields[field];
    session.verification.history.push({ event: "FIELD_VERIFIED", field });
  } else {
    session.verification.rejectedFields[field] = value;
    session.verification.history.push({ event: "FIELD_REJECTED", field });
  }
  return result;
}

function policySatisfied(session) {
  const p = VERIFICATION_POLICIES[session.role];
  if (!p || p.manual) return false;
  const vf = session.verification.verifiedFields;

  const primaryOk = p.primary
    ? p.primary.every((f) => vf[f])
    : p.primaryAlternatives?.some((group) => group.every((f) => vf[f]));

  const altOk = p.alternatives?.some((group) => group.every((f) => vf[f]));
  return Boolean(primaryOk && altOk);
}

function nextVerificationOptions(session) {
  const p = VERIFICATION_POLICIES[session.role];
  if (!p) return { messageKey: "role_required", missing: [], quickActions: ROLE_OPTIONS };
  if (p.manual) return { messageKey: "manual_verification", missing: [], quickActions: [] };

  const vf = session.verification.verifiedFields;
  const primaryGroups = p.primary ? [p.primary] : (p.primaryAlternatives || []);
  const primaryComplete = primaryGroups.some((group) => group.every((f) => vf[f]));

  if (!primaryComplete) {
    const choices = primaryGroups
      .map((group) => group.find((f) => !vf[f]))
      .filter(Boolean);
    return { messageKey: "need_primary", missing: [...new Set(choices)], quickActions: [] };
  }

  const altComplete = p.alternatives.some((group) => group.every((f) => vf[f]));
  if (!altComplete) {
    const alternatives = p.alternatives.map((group) => group.filter((f) => !vf[f]));
    return { messageKey: "need_secondary", missing: alternatives.flat(), alternativeGroups: alternatives, quickActions: [] };
  }

  return { messageKey: "verified", missing: [], quickActions: [] };
}

export function applyPlan({ plan, currentSession }) {
  const session = cloneSession(currentSession);
  const toolTrace = [];
  const toolContext = [];

  if (Array.isArray(plan.intents) && plan.intents.length) {
    session.activeIntents = [...new Set(plan.intents)];
  }

  if (plan.dialogueAct === "restart") {
    return {
      session: blankSession(),
      toolTrace,
      toolContext: [{ type: "state", result: "RESTARTED" }],
      ui: { quickActions: [] }
    };
  }

  if (plan.roleCandidate) setRole(session, plan.roleCandidate);

  if (plan.dialogueAct === "correct_info" && plan.correction?.field) {
    const field = plan.correction.field;
    invalidateDownstream(session, field);
    delete session.verification.verifiedFields[field];
    session.verification.history.push({ event: "FIELD_CORRECTION_REQUESTED", field });
    toolContext.push({ type: "correction", field, result: "PREVIOUS_VALUE_INVALIDATED" });
  }

  if (plan.dialogueAct === "change_role" && plan.roleCandidate) {
    setRole(session, plan.roleCandidate);
    toolContext.push({ type: "role_change", role: session.role });
  }

  const provided = plan.provided || {};
  const orderedFields = ["tckn", "vkn", "servisKodu", "partajNo", "dogumTarihi", "plaka", "dosyaNo", "policeNo"];

  for (const field of orderedFields) {
    const value = provided[field];
    if (!value) continue;

    if (["tckn", "vkn", "servisKodu", "partajNo"].includes(field) && !session.role) {
      const lookup = lookupByIdentifier({ field, value });
      toolTrace.push({ name: "lookup_by_identifier", input: { field }, result: { found: lookup.found, count: lookup.count } });
      toolContext.push({ type: "identifier_lookup", field, result: lookup.found ? "FOUND_BUT_ROLE_REQUIRED" : "NOT_FOUND" });
      continue;
    }

    const result = verifyOne(session, field, value, toolTrace);
    toolContext.push({ type: "verification", field, result: result.ok ? "MATCH" : "NO_MATCH" });

    if (result.ok && field === "dosyaNo") session.activeClaimNo = value;
    if (result.ok && field === "policeNo") session.activePolicyNo = value;
  }

  const policy = session.role ? VERIFICATION_POLICIES[session.role] : null;
  if (policy?.manual) {
    session.verification.status = "NEEDS_AGENT";
    toolContext.push({ type: "policy", result: "MANUAL_VERIFICATION_REQUIRED", reason: policy.reason });
  } else if (session.role && policySatisfied(session)) {
    session.verification.status = "VERIFIED";
  } else {
    session.verification.status = session.role ? "IN_PROGRESS" : "UNVERIFIED";
  }

  const verificationNext = nextVerificationOptions(session);

  const verified = session.verification.status === "VERIFIED";
  const wantsClaimData = session.activeIntents.some((x) =>
    ["claim_status", "payment", "documents", "expert", "service"].includes(x)
  );

  if (verified && wantsClaimData) {
    const claimNo = session.activeClaimNo || session.verification.verifiedFields.dosyaNo;
    if (claimNo) {
      const claimResult = getClaim({ claimNo, role: session.role, verified });
      toolTrace.push({ name: "get_claim", input: { claimNo }, result: { ok: claimResult.ok, reason: claimResult.reason || null } });
      toolContext.push({ type: "claim_data", result: claimResult });
    }
  }

  if (verified && session.activeIntents.includes("policy")) {
    const policyNo = session.activePolicyNo || session.verification.verifiedFields.policeNo;
    if (policyNo) {
      const policyResult = getPolicy({ policyNo, role: session.role, verified });
      toolTrace.push({ name: "get_policy", input: { policyNo }, result: { ok: policyResult.ok, reason: policyResult.reason || null } });
      toolContext.push({ type: "policy_data", result: policyResult });
    }
  }

  session.lastToolResult = toolContext.at(-1) || null;

  return {
    session,
    toolTrace,
    toolContext,
    ui: {
      quickActions: !session.role ? ROLE_OPTIONS : []
    },
    verificationNext
  };
}
