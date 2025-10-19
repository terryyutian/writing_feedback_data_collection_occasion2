const API_BASE = ""; // same-origin

export async function login(email) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ email })
  });
  if (!res.ok) {
    const detail = await res.json().catch(()=>({}));
    throw new Error(detail?.detail || res.statusText);
  }
  return res.json();
}

export async function fetchDraft(asurite) {
  const res = await fetch(`${API_BASE}/api/draft/${encodeURIComponent(asurite)}`);
  if (!res.ok) {
    const detail = await res.json().catch(()=>({}));
    throw new Error(detail?.detail || res.statusText);
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
    const detail = await res.json().catch(()=>({}));
    throw new Error(detail?.detail || res.statusText);
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
    const detail = await res.json().catch(()=>({}));
    throw new Error(Array.isArray(detail?.detail) ? detail.detail.join("\n") : (detail?.detail || res.statusText));
  }
  return res.json();
}
