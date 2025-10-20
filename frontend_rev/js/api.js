// frontend_rev/js/api.js
const API_BASE = ""; // same-origin

async function parseErrorMessage(res) {
  // Try to parse structured JSON error body and return a friendly string.
  let detail = null;
  try {
    detail = await res.json();
  } catch (e) {
    detail = null;
  }

  // Status-specific friendly messages
  if (res.status === 422) {
    // Validation error from Pydantic (e.g., invalid email)
    return "Please enter a valid ASU email address.";
  }

  if (res.status === 404) {
    // Keep the very specific friendly message for login/draft not found
    // but handle other 404s generically if detail is different
    const maybeDetail = detail?.detail ?? detail;
    if (typeof maybeDetail === "string" && maybeDetail.includes("Participant or draft not found")) {
      return "Hmm, we couldn’t find an account with that email address. Please check and try again.";
    }
    // fallback for 404
    return typeof maybeDetail === "string" ? maybeDetail : "Not found.";
  }

  // If the body is an object with a `detail` field:
  if (detail && typeof detail === "object") {
    const d = detail.detail ?? detail;
    if (typeof d === "string" && d.trim() !== "") {
      return d;
    }
    // If detail is an array (validation errors), try to join messages
    if (Array.isArray(d)) {
      try {
        // Many validation errors are array of objects with 'loc','msg','type'
        const joined = d.map(item => {
          if (typeof item === "string") return item;
          if (item && typeof item.msg === "string") return item.msg;
          if (item && typeof item.detail === "string") return item.detail;
          // fallback to JSON snippet
          return JSON.stringify(item);
        }).join("\n");
        if (joined) return joined;
      } catch (e) {
        // fall through
      }
    }
    // If detail is an object with keys, return a concise JSON string
    try {
      const str = JSON.stringify(d);
      if (str && str !== "{}") return str;
    } catch (e) {
      // fall through
    }
  }

  // Fallback: use statusText if present, otherwise a generic message
  return res.statusText || "An error occurred. Please try again.";
}

export async function login(email) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ email })
  });
  if (!res.ok) {
    const msg = await parseErrorMessage(res);
    throw new Error(msg);
  }
  return res.json();
}

export async function fetchDraft(asurite) {
  const res = await fetch(`${API_BASE}/api/draft/${encodeURIComponent(asurite)}`);
  if (!res.ok) {
    const msg = await parseErrorMessage(res);
    throw new Error(msg);
  }
  return res.json();
}

export async function startSession(asurite) {
  const res = await fetch(`/api/session/start`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ asurite })
  });
  if (!res.ok) {
    const msg = await parseErrorMessage(res);
    throw new Error(msg);
  }
  return res.json();
}

export async function completeLanguage(sessionId, languageRevision, rating, revisionDurationSeconds = null) {
  const body = { session_id: sessionId, language_revision_text: languageRevision, language_rating: rating };
  if (revisionDurationSeconds !== null && revisionDurationSeconds !== undefined) {
    body.revision_duration_seconds = revisionDurationSeconds;
  }
  const res = await fetch(`/api/revision/language/complete`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const msg = await parseErrorMessage(res);
    throw new Error(Array.isArray(msg) ? msg.join("\n") : msg);
  }
  return res.json();
}
