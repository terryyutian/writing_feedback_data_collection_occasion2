// frontend_rev/js/app.js
import { login, fetchDraft, startSession, completeLanguage, submitContent } from "./api.js";

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
  mode: "language" // or "content"
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
const feedbackBox = document.getElementById("feedbackBox");
const draftEditor = document.getElementById("draftEditor");
const revTitle = document.getElementById("revTitle");
const revInstruction = document.getElementById("revInstruction");
const btnProceedContent = document.getElementById("btnProceedContent");
const btnSubmitFinal = document.getElementById("btnSubmitFinal");

/* Floating rating overlay elements (new) */
const ratingOverlay = document.getElementById("ratingOverlay");
const likertFloating = document.getElementById("likertFloating");
const btnSubmitMyRating = document.getElementById("btnSubmitMyRating");
const ratingThanks = document.getElementById("ratingThanks");
const btnRatingOk = document.getElementById("btnRatingOk");
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
  // start session if not started
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
  if (feedbackBox) feedbackBox.value = state.draft?.language_feedback || "";
  if (draftEditor) draftEditor.value = state.draft?.essay_text || "";
  if (feedbackBox) feedbackBox.readOnly = true;
  // Hide overlays if present
  hideRatingOverlay();
  hideRatingThanks();
  // Controls
  if (btnProceedContent) btnProceedContent.style.display = "inline-block";
  if (btnSubmitFinal) btnSubmitFinal.style.display = "none";
  // bind guards
  bindWriteTextareaGuards();
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

/* ---------------------- Proceed to rating (floating overlay) ---------------------- */
btnProceedContent?.addEventListener("click", async () => {
  const proceed = confirm("Are you sure you have completed your language revision and are ready to rate the language feedback?");
  if (!proceed) return;

  // Show the floating rating overlay
  showRatingOverlay();
});

/* ---------------------- Floating rating interactions ---------------------- */
/* Show / hide helpers */
function showRatingOverlay() {
  if (!ratingOverlay) return;
  // clear previous selection
  likertFloating?.querySelectorAll(".circle").forEach(c => c.classList.remove("selected"));
  state.languageRating = null;
  if (btnSubmitMyRating) btnSubmitMyRating.disabled = false;
  ratingOverlay.style.display = "block";
  ratingOverlay.setAttribute("aria-hidden", "false");
  // center it visually
  ratingOverlay.style.left = "50%";
  ratingOverlay.style.top = "50%";
  ratingOverlay.style.transform = "translate(-50%, -50%)";
}

function hideRatingOverlay() {
  if (!ratingOverlay) return;
  ratingOverlay.style.display = "none";
  ratingOverlay.setAttribute("aria-hidden", "true");
}

function showRatingThanks() {
  if (!ratingThanks) return;
  ratingThanks.style.display = "block";
  ratingThanks.setAttribute("aria-hidden", "false");
}

function hideRatingThanks() {
  if (!ratingThanks) return;
  ratingThanks.style.display = "none";
  ratingThanks.setAttribute("aria-hidden", "true");
}

/* Handle selection inside floating likert using event delegation */
likertFloating?.addEventListener("click", (e) => {
  const el = e.target.closest?.(".circle");
  if (!el) return;
  likertFloating.querySelectorAll(".circle").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  state.languageRating = parseInt(el.dataset.value, 10);
});

/* Submit My Rating -> call backend and show thanks overlay */
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
    await completeLanguage(state.sessionId, languageRevisionText, state.languageRating);
    // hide overlay and show thanks
    hideRatingOverlay();
    showRatingThanks();
  } catch (err) {
    alert(err.message || "Failed to submit rating. Please try again.");
  } finally {
    btnSubmitMyRating.disabled = false;
  }
});

/* After OK on the "Thanks" overlay -> swap to content revision */
btnRatingOk?.addEventListener("click", () => {
  hideRatingThanks();

  // Replace feedback with content feedback
  if (feedbackBox) feedbackBox.value = state.draft?.content_feedback || "";

  // Update instruction and title
  if (revTitle) revTitle.textContent = "Content Revision";
  if (revInstruction) {
    revInstruction.textContent = "Now, you will have another 10 minutes to revise the content of your draft using the content-focused feedback provided.";
  }

  // Swap controls
  if (btnProceedContent) btnProceedContent.style.display = "none";
  if (btnSubmitFinal) btnSubmitFinal.style.display = "inline-block";

  state.mode = "content";
});

/* ---------------------- Final submit ---------------------- */
btnSubmitFinal?.addEventListener("click", async () => {
  const proceed = confirm("Are you sure you want to submit your revised version?");
  if (!proceed) return;
  if (!state.sessionId) {
    alert("Missing session. Please restart.");
    return;
  }
  btnSubmitFinal.disabled = true;
  try {
    const contentRevisionText = (draftEditor.value || "").trim();
    await submitContent(state.sessionId, contentRevisionText);
    show(screens.thanks);
  } catch (err) {
    alert(err.message || "Failed to submit final revision.");
  } finally {
    btnSubmitFinal.disabled = false;
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
  // style floating overlay circles (if present)
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

  // Add selected CSS class if not already defined
  const style = document.createElement("style");
  style.textContent = `
    #likertFloating .circle.selected { background: var(--accent); color: #052e16; }
    #likertFloating .circle:hover { transform: translateY(-2px); }
  `;
  document.head.appendChild(style);

  // Ensure only the login screen is active on initial load if none set
  if (!document.querySelector(".screen.active")) {
    const first = document.getElementById("screen-login");
    if (first) first.classList.add("active");
  }
});
