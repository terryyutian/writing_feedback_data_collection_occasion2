// frontend_rev/js/app.js
import { login, fetchDraft, startSession, completeLanguage } from "./api.js";

/* ---------------------- Screens & State ---------------------- */
const screens = {
  login: document.getElementById("screen-login"),
  confirm: document.getElementById("screen-confirm"),
  instructions: document.getElementById("screen-instructions"),
  revision: document.getElementById("screen-revision"),
  thanks: document.getElementById("screen-thanks"),
};

const state = {
  email: null,
  asurite: null,
  draft: null,
  sessionId: null,
  languageRating: null,
  mode: "language",
  revisionStart: null,
  // feedback navigation
  feedbackParts: [],   // array of strings to show sequentially
  feedbackIndex: 0,
  feedbackVisited: []  // parallel boolean array marking which parts have been seen
};

/* simple show/hide helper */
function show(screen) {
  Object.values(screens).forEach(s => s?.classList.remove("active"));
  screen?.classList.add("active");
  const header = document.querySelector(".site-header");
  if (header) header.style.display = (screen === screens.login ? "block" : "none");
}

/* ---------------------- Elements ---------------------- */
/* Login */
const loginEmail = document.getElementById("loginEmail");
const btnLogin = document.getElementById("btnLogin");

/* Confirm */
const btnConfirmYes = document.getElementById("btnConfirmYes");
const btnConfirmNo = document.getElementById("btnConfirmNo");

/* Instructions */
const btnInstrAgree = document.getElementById("btnInstrAgree");

/* Revision page elements */
const feedbackPanel = document.getElementById("feedbackPanel");
const btnFeedbackBack = document.getElementById("btnFeedbackBack");
const btnFeedbackNext = document.getElementById("btnFeedbackNext");
const draftEditor = document.getElementById("draftEditor");
const revTitle = document.getElementById("revTitle");
const revInstruction = document.getElementById("revInstruction");
/* Submit button (previously 'Proceed') — keep the same id your HTML uses */
const btnSubmit = document.getElementById("btnProceedContent"); // labeled "Submit" in HTML

/* Floating rating overlay elements */
const ratingOverlay = document.getElementById("ratingOverlay");
const likertFloating = document.getElementById("likertFloating");
const btnSubmitMyRating = document.getElementById("btnSubmitMyRating");
const ratingHandle = document.getElementById("ratingHandle"); // may be null on tiny screens

/* ---------------------- Login flow ---------------------- */
btnLogin?.addEventListener("click", async () => {
  const email = (loginEmail.value || "").trim().toLowerCase();
  if (!email) { alert("Please enter your ASU email."); return; }
  btnLogin.disabled = true;
  try {
    const res = await login(email);
    state.email = email;
    state.asurite = res.asurite;
    // fetch draft
    const draft = await fetchDraft(state.asurite);
    state.draft = draft;
    const draftBox = document.getElementById("draftBox");
    if (draftBox) draftBox.textContent = draft.essay_text || "";
    show(screens.confirm);
  } catch (err) {
    alert(err.message || "Login failed. Please contact researchers.");
  } finally { btnLogin.disabled = false; }
});

/* ---------------------- Confirm flow ---------------------- */
btnConfirmYes?.addEventListener("click", () => {
  show(screens.instructions);
});

btnConfirmNo?.addEventListener("click", () => {
  alert("We are sorry for this oversight. Please contact the researchers for help.");
});

/* ---------------------- Instructions -> Start Session ---------------------- */
btnInstrAgree?.addEventListener("click", async () => {
  if (!state.asurite) {
    alert("Missing participant info. Please login again.");
    return;
  }
  if (!state.sessionId) {
    try {
      const s = await startSession(state.asurite);
      state.sessionId = s.session_id;
    } catch (err) {
      alert(err.message || "Failed to start session.");
      return;
    }
  }
  setupRevisionPage();
  show(screens.revision);
});

/* ---------------------- Revision Page Setup & Guards ---------------------- */
function setupRevisionPage() {
  state.mode = "language";
  revTitle.textContent = "Language Revision";
  if (revInstruction) {
    revInstruction.textContent = "Now, you will have 10 minutes to improve the language in your draft. In this step, focus only on enhancing language quality using the language-focused feedback provided.";
  }

  // Populate draft text
  if (draftEditor) draftEditor.value = state.draft?.essay_text || "";

  // Build feedback parts array from draft fields (use safe textContent for dynamic parts)
  const strengthsText = state.draft?.feedback_strengths || "";
  const area1 = state.draft?.feedback_area1 || "";
  const area2 = state.draft?.feedback_area2 || "";
  const area3 = state.draft?.feedback_area3 || "";

  state.feedbackParts = [
    // Strengths template
    `Your essay is engaging and well written! Here are some strengths in your language use:\n\n${strengthsText}\n\nTo further improve your essay, I’ve listed three areas to work on. Click **NEXT** to see them.`,
    // Area One
    `**Area One**:\n${area1}`,
    // Area Two
    `**Area Two**:\n${area2}`,
    // Area Three
    `**Area Three**:\n${area3}`,
  ];

  // initialize visited tracker (false for each part)
  state.feedbackVisited = state.feedbackParts.map(() => false);
  state.feedbackIndex = 0;

  renderFeedbackPart();

  // Hide rating overlay if present
  hideRatingOverlay();

  // Initially hide Submit button until areas 1..3 have been viewed
  if (btnSubmit) {
    btnSubmit.style.display = "none";
    btnSubmit.disabled = false;
  }

  // record start time (ms)
  state.revisionStart = Date.now();

  // bind guards for editor
  bindWriteTextareaGuards();
}

/* Render the current feedback part into the feedbackPanel */
function renderFeedbackPart() {
  if (!feedbackPanel) return;
  const idx = state.feedbackIndex ?? 0;
  const raw = state.feedbackParts[idx] ?? "";

  // Mark this index as visited
  state.feedbackVisited[idx] = true;

  // Convert **bold** markers into safe bold HTML while escaping other content
  // First escape full raw text, then convert escaped **text** sequences into <strong>
  const escaped = escapeHtml(raw);
  const withBold = escaped.replace(/\\*\\*(.+?)\\*\\*/g, (m, p1) => `**${p1}**`); // defensive no-op if not needed
  // Now replace **...** tokens with <strong> around already-escaped content
  const html = escaped.replace(/\*\*(.+?)\*\*/g, (_, p1) => `<strong>${escapeHtml(p1)}</strong>`).replace(/\n/g, "<br>");

  feedbackPanel.innerHTML = html;

  // Back / Next button visibility rules:
  if (btnFeedbackBack) btnFeedbackBack.style.display = (idx === 0 ? "none" : "inline-block");
  if (btnFeedbackNext) btnFeedbackNext.style.display = (idx >= state.feedbackParts.length - 1 ? "none" : "inline-block");

  // Check if all three area parts (indexes 1..3) have been viewed at least once
  const areasViewed = state.feedbackVisited[1] && state.feedbackVisited[2] && state.feedbackVisited[3];
  if (btnSubmit) {
    if (areasViewed) {
      btnSubmit.style.display = "block"; // show centered by CSS rule
    } else {
      btnSubmit.style.display = "none";
    }
  }
}

/* escape helper to prevent HTML injection */
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* Prevent copy/paste and context menu on draft editor */
function bindWriteTextareaGuards() {
  const textarea = draftEditor;
  if (!textarea || textarea.dataset.guarded === "1") return;
  textarea.dataset.guarded = "1";

  ["paste", "copy", "cut", "dragstart", "drop", "dragover", "contextmenu"].forEach(evt =>
    textarea.addEventListener(evt, e => e.preventDefault())
  );

  textarea.addEventListener("keydown", e => {
    const k = e.key?.toLowerCase?.() || "";
    if ((e.ctrlKey || e.metaKey) && (k === "c" || k === "v" || k === "x")) {
      e.preventDefault();
    }
  });
}

/* ---------------------- Feedback navigation handlers ---------------------- */
btnFeedbackBack?.addEventListener("click", () => {
  if (state.feedbackIndex > 0) {
    state.feedbackIndex -= 1;
    renderFeedbackPart();
  }
});

btnFeedbackNext?.addEventListener("click", () => {
  if (state.feedbackIndex < state.feedbackParts.length - 1) {
    state.feedbackIndex += 1;
    renderFeedbackPart();
  }
});

/* ---------------------- Submit -> rating (floating overlay) ---------------------- */
btnSubmit?.addEventListener("click", async () => {
  const proceed = confirm("Are you sure you have completed your language revision and are ready to rate the language feedback?");
  if (!proceed) return;
  // Show the floating rating overlay
  showRatingOverlay();
});

/* ---------------------- Floating rating interactions ---------------------- */
/* Show / hide helpers */
function showRatingOverlay() {
  if (!ratingOverlay) return;
  likertFloating?.querySelectorAll(".circle").forEach(c => c.classList.remove("selected"));
  state.languageRating = null;
  if (btnSubmitMyRating) btnSubmitMyRating.disabled = false;
  ratingOverlay.style.display = "block";
  ratingOverlay.setAttribute("aria-hidden", "false");
  ratingOverlay.style.left = "50%";
  ratingOverlay.style.top = "50%";
  ratingOverlay.style.transform = "translate(-50%, -50%)";
}

function hideRatingOverlay() {
  if (!ratingOverlay) return;
  ratingOverlay.style.display = "none";
  ratingOverlay.setAttribute("aria-hidden", "true");
}

/* Handle selection inside floating likert using event delegation */
likertFloating?.addEventListener("click", (e) => {
  const el = e.target.closest?.(".circle");
  if (!el) return;
  likertFloating.querySelectorAll(".circle").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  state.languageRating = parseInt(el.dataset.value, 10);
});

/* Submit My Rating -> call backend and then finish (thanks page) */
btnSubmitMyRating?.addEventListener("click", async () => {
  if (!state.languageRating) {
    alert("Please select a rating (1–5) before submitting.");
    return;
  }
  if (!state.sessionId) {
    alert("Missing session. Please restart the session.");
    return;
  }
  btnSubmitMyRating.disabled = true;
  try {
    const languageRevisionText = (draftEditor.value || "").trim();
    const now = Date.now();
    let revisionDurationSeconds = null;
    if (state.revisionStart) {
      revisionDurationSeconds = Math.max(0, (now - state.revisionStart) / 1000);
    }
    await completeLanguage(state.sessionId, languageRevisionText, state.languageRating, revisionDurationSeconds);
    hideRatingOverlay();
    show(screens.thanks);
  } catch (err) {
    alert(err.message || "Failed to submit rating. Please try again.");
  } finally {
    btnSubmitMyRating.disabled = false;
  }
});

/* ---------------------- Draggable overlay (mouse + touch) ---------------------- */
(function makeOverlayDraggable() {
  if (!ratingOverlay) return;
  const handle = ratingHandle || ratingOverlay; // prefer handle if present
  let isDragging = false;
  let startX = 0, startY = 0;
  let origLeft = 0, origTop = 0;

  function onMouseDown(e) {
    isDragging = true;
    handle.style.cursor = "grabbing";
    startX = e.clientX;
    startY = e.clientY;
    const rect = ratingOverlay.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    e.preventDefault();
  }
  function onMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    ratingOverlay.style.left = (origLeft + dx) + "px";
    ratingOverlay.style.top = (origTop + dy) + "px";
    ratingOverlay.style.transform = "none";
  }
  function onMouseUp() {
    isDragging = false;
    handle.style.cursor = "grab";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  function onTouchStart(e) {
    if (!e.touches || e.touches.length === 0) return;
    isDragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    const rect = ratingOverlay.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
  }
  function onTouchMove(e) {
    if (!isDragging || !e.touches || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    ratingOverlay.style.left = (origLeft + dx) + "px";
    ratingOverlay.style.top = (origTop + dy) + "px";
    ratingOverlay.style.transform = "none";
    e.preventDefault();
  }
  function onTouchEnd() {
    isDragging = false;
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
  }

  handle.addEventListener("mousedown", onMouseDown);
  handle.addEventListener("touchstart", onTouchStart, { passive: false });
})();

/* ---------------------- Initialize visual styles for circles ---------------------- */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#likertFloating .circle").forEach(c => {
    c.style.width = "44px";
    c.style.height = "44px";
    c.style.borderRadius = "999px";
    c.style.border = "2px solid var(--accent)";
    c.style.display = "inline-flex";
    c.style.alignItems = "center";
    c.style.justifyContent = "center";
    c.style.cursor = "pointer";
    c.style.margin = "0 6px";
    c.style.fontWeight = "700";
    c.style.userSelect = "none";
  });

  const style = document.createElement("style");
  style.textContent = `
    #likertFloating .circle.selected { background: var(--accent); color: #052e16; }
    #likertFloating .circle:hover { transform: translateY(-2px); }
  `;
  document.head.appendChild(style);

  if (!document.querySelector(".screen.active")) {
    const first = document.getElementById("screen-login");
    if (first) first.classList.add("active");
  }
});
