import { classifyCategory, classifyIntent } from "./intent-service.mjs";
import { applyStaticTranslations } from "./i18n.mjs";
import { VoiceService } from "./voice-service.js";

const $ = (selector) => document.querySelector(selector);
let language = localStorage.getItem("school360-language") === "en" ? "en" : "hi";
const text = (hindi, english) => language === "en" ? english : hindi;
const labels = {
  category: {
    WATER: { hi: "पीने का पानी", en: "Drinking water" },
    TOILETS: { hi: "शौचालय", en: "Toilets" },
    ELECTRICITY: { hi: "बिजली", en: "Electricity" },
    CLASSROOM: { hi: "कक्षा", en: "Classroom" },
    FURNITURE: { hi: "फर्नीचर", en: "Furniture" },
    CLEANLINESS: { hi: "सफाई", en: "Cleanliness" },
    OTHER: { hi: "अन्य", en: "Other" },
  },
  facility: {
    "Drinking Water": { hi: "पीने का पानी", en: "Drinking water" },
    Toilets: { hi: "शौचालय", en: "Toilets" },
    Electricity: { hi: "बिजली", en: "Electricity" },
    Classrooms: { hi: "कक्षाएँ", en: "Classrooms" },
    Furniture: { hi: "फर्नीचर", en: "Furniture" },
    Playground: { hi: "खेल का मैदान", en: "Playground" },
    "Boundary Wall": { hi: "चारदीवारी", en: "Boundary wall" },
    Library: { hi: "पुस्तकालय", en: "Library" },
    "Internet Connectivity": { hi: "इंटरनेट", en: "Internet" },
    "Handwashing Facilities": { hi: "हाथ धोने की सुविधा", en: "Handwashing facilities" },
  },
  status: {
    SUBMITTED: { hi: "दर्ज हुई", en: "Submitted" },
    UNDER_REVIEW: { hi: "जाँच में", en: "Under review" },
    IN_PROGRESS: { hi: "काम जारी", en: "In progress" },
    RESOLVED: { hi: "समाधान हुआ", en: "Resolved" },
    REJECTED: { hi: "अस्वीकृत", en: "Rejected" },
  },
};
const schoolTypeLabels = {
  "Government Primary": { hi: "सरकारी प्राथमिक", en: "Government Primary" },
  Government: { hi: "सरकारी", en: "Government" },
  Primary: { hi: "प्राथमिक", en: "Primary" },
  "Upper Primary": { hi: "उच्च प्राथमिक", en: "Upper Primary" },
  Secondary: { hi: "माध्यमिक", en: "Secondary" },
};
const statusClass = {
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  REJECTED: "rejected",
};
const categoryOptions = Object.keys(labels.category);
const statusOptions = Object.keys(labels.status);
const state = {
  selectedSchool: null,
  reportDraft: null,
  awaitingReportId: false,
  schools: [],
};

function label(group, key) {
  return labels[group][key]?.[language] ?? key;
}

function schoolTypeLabel(type) {
  return schoolTypeLabels[type]?.[language] ?? type;
}

function locationLabel(value) {
  const locations = {
    "Kanpur Nagar": { hi: "कानपुर नगर", en: "Kanpur Nagar" },
    "Kanpur Dehat": { hi: "कानपुर देहात", en: "Kanpur Dehat" },
    "Uttar Pradesh": { hi: "उत्तर प्रदेश", en: "Uttar Pradesh" },
  };
  return locations[value]?.[language] ?? value;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error ?? `Request failed (${response.status}).`);
    error.status = response.status;
    error.reportId = result.reportId;
    throw error;
  }
  return result;
}

function say(text) {
  addMessage("assistant", text);
  voice.speak(text);
}

function sayLocalized(hindi, english) {
  say(text(hindi, english));
}

function addReportIdCard(id) {
  const card = document.createElement("div");
  card.className = "report-id-card";
  card.setAttribute("role", "status");

  const details = document.createElement("div");
  const label = document.createElement("span");
  label.textContent = text("आपकी रिपोर्ट ID", "Your report ID");
  const value = document.createElement("strong");
  value.textContent = String(id);
  details.append(label, value);

  const trackButton = document.createElement("button");
  trackButton.type = "button";
  trackButton.textContent = text("स्थिति देखें", "Track status");
  trackButton.addEventListener("click", () => {
    $("#report-id").value = String(id);
    loadMyReports(String(id)).catch(showError);
    $("#my-reports").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  card.append(details, trackButton);
  $("#conversation").append(card);
  $("#conversation").scrollTop = $("#conversation").scrollHeight;
}

function addMessage(role, text) {
  const conversation = $("#conversation");
  const message = document.createElement("div");
  message.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;
  if (role === "user") {
    message.innerHTML = `<p>${escapeHtml(text)}</p>`;
  } else {
    message.innerHTML = `<span class="message-avatar">S</span><p>${escapeHtml(text)}</p>`;
  }
  conversation.append(message);
  conversation.scrollTop = conversation.scrollHeight;
}

function setVoiceState(nextState, message) {
  $("#voice-state").dataset.state = nextState;
  $("#voice-status").textContent = message;
  $("#mic-button").dataset.listening = String(nextState === "listening");
  $("#mic-label").textContent = nextState === "listening"
    ? text("सुनना बंद करें", "Stop listening")
    : text("बोलने के लिए दबाएँ", "Tap to speak");
  $("#mic-button").setAttribute("aria-label", text("बोलने के लिए शुरू करें", "Start speaking"));
}

function onVoiceError(message) {
  $("#transcript").textContent = message;
}

const voice = new VoiceService({
  onTranscript(text, isFinal) {
    $("#transcript").textContent = isFinal
      ? `${language === "en" ? "You said" : "आपने कहा"}: ${text}`
      : `...${text}`;
    if (isFinal) processMessage(text);
  },
  onStateChange: setVoiceState,
  onError: onVoiceError,
});

function dateLabel(dateValue) {
  if (!dateValue) return text("तारीख उपलब्ध नहीं", "Date unavailable");
  const locale = language === "en" ? "en-IN" : "hi-IN";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(dateValue));
}

function schoolCard(school) {
  const isDemo = school.name.startsWith("DEMO DATA");
  const address = school.address ?? text("पता उपलब्ध नहीं", "Address not available");
  return `<article class="school-card">
    <h3>${escapeHtml(school.name)}</h3>
    <p>${escapeHtml(school.block_name)}, ${escapeHtml(locationLabel(school.district_name))}</p>
    <p>${escapeHtml(address)}</p>
    <div class="school-meta"><span class="tag">${escapeHtml(schoolTypeLabel(school.school_type))}</span>
      ${isDemo ? `<span class="tag demo">${text("केवल डेमो डेटा", "Demo data only")}</span>` : ""}
      ${school.has_location ? `<span class="tag">${text("स्थान उपलब्ध", "Location available")}</span>` : ""}
    </div>
    <button type="button" data-school-id="${escapeHtml(school.id)}">${text("स्कूल की जानकारी देखें →", "View school details →")}</button>
  </article>`;
}

function showSchoolResults(schools, emptyText = text("इस खोज से कोई स्कूल नहीं मिला।", "No schools matched your search.")) {
  state.schools = schools;
  const container = $("#school-results");
  if (!schools.length) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(emptyText)}</p>`;
    return;
  }
  container.innerHTML = schools.map(schoolCard).join("");
}

async function searchSchoolList({ q = "", district = "", type = "" } = {}) {
  const params = new URLSearchParams();
  if (q) {
    const hindiDistrict = q.includes("कानपुर देहात")
      ? "Kanpur Dehat"
      : q.includes("कानपुर")
        ? "Kanpur Nagar"
        : q;
    params.set("q", hindiDistrict);
  }
  if (district) params.set("district", district);
  if (type) params.set("type", type);
  const result = await request(`/api/schools?${params}`);
  showSchoolResults(result.schools);
  return result.schools;
}

function conditionDescription(condition, verification) {
  const conditionText = {
    GOOD: text("उपलब्ध", "Available"),
    NEEDS_REPAIR: text("मरम्मत की ज़रूरत", "Needs repair"),
    DAMAGED: text("उपलब्ध नहीं / खराब", "Unavailable / damaged"),
    UNKNOWN: text("जानकारी उपलब्ध नहीं", "Information unavailable"),
  }[condition] ?? text("जानकारी उपलब्ध नहीं", "Information unavailable");
  const verificationText = {
    VERIFIED: text("सत्यापित", "Verified"),
    UNVERIFIED: text("असत्यापित", "Unverified"),
    UNKNOWN: text("सत्यापन की जानकारी नहीं", "Verification unknown"),
  }[verification] ?? text("सत्यापन की जानकारी नहीं", "Verification unknown");
  return `${conditionText} · ${verificationText}`;
}

async function loadSchoolDetail(id) {
  const { school } = await request(`/api/schools/${encodeURIComponent(id)}`);
  state.selectedSchool = school;
  renderSchoolDetail(school);
}

function renderSchoolDetail(school) {
  const detail = $("#school-detail");
  const address = [school.block_name, locationLabel(school.district_name), locationLabel(school.state_name)]
    .filter(Boolean).join(", ");
  detail.innerHTML = `<div class="detail-top"><div><p class="eyebrow">${text("स्कूल की जानकारी", "School details")}</p>
      <h3>${escapeHtml(school.name)}</h3><p class="section-subtitle">${escapeHtml(address)}</p>
      <p class="section-subtitle">${escapeHtml(schoolTypeLabel(school.school_type))} · ${school.longitude == null ? text("मानचित्र स्थान उपलब्ध नहीं", "Map location unavailable") : text("मानचित्र स्थान उपलब्ध", "Map location available")}</p>
      ${school.name.startsWith("DEMO DATA") ? `<span class="tag demo">${text("केवल डेमो डेटा — वास्तविक स्कूल नहीं", "Demo data only — not a real school")}</span>` : ""}
    </div><button id="close-school-detail" class="button button-outline" type="button">${text("बंद करें", "Close")}</button></div>
    <div class="facility-grid">${school.facilities.map((facility) => `<div class="facility-item">
      <strong>${escapeHtml(label("facility", facility.name))}</strong>
      <span>${escapeHtml(conditionDescription(facility.condition_status, facility.verification_status))}</span>
      ${facility.last_inspected_at ? `<span>${text("जाँच", "Inspected")}: ${escapeHtml(dateLabel(facility.last_inspected_at))}</span>` : ""}
    </div>`).join("")}</div>
    <button id="report-about-school" class="button button-primary detail-report" type="button">${text("इस स्कूल की समस्या बताएँ", "Report a problem at this school")}</button>`;
  detail.hidden = false;
  detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
  $("#close-school-detail").addEventListener("click", () => { detail.hidden = true; });
  $("#report-about-school").addEventListener("click", () => {
    $("#chat-message").focus();
    document.location.hash = "assistant";
    say(text(
      `आपने ${school.name} चुना है। अब समस्या बताइए, जैसे “पानी की टंकी खराब है।”`,
      `You selected ${school.name}. Describe the problem, for example: “The water tank is damaged.”`,
    ));
  });
}

function setReportDraft({ category, description }) {
  state.reportDraft = {
    category,
    description,
    school: state.selectedSchool,
    awaiting: state.selectedSchool ? "confirmation" : "school",
  };
}

function askToSelectSchool() {
  sayLocalized(
    "रिपोर्ट के लिए कृपया स्कूल चुनें। नीचे स्कूल खोजें या कोई स्कूल कार्ड चुनें।",
    "Please choose a school for this report. Search below or select a school card.",
  );
  searchSchoolList().catch(showError);
  $("#schools").scrollIntoView({ behavior: "smooth", block: "start" });
}

function askReportConfirmation() {
  const draft = state.reportDraft;
  draft.awaiting = "confirmation";
  sayLocalized(
    `${draft.school.name} के लिए यह रिपोर्ट दर्ज करूँ: “${draft.description}”? हाँ कहें या नहीं।`,
    `Should I submit this report for ${draft.school.name}: “${draft.description}”? Say yes or no.`,
  );
}

async function submitReport() {
  const draft = state.reportDraft;
  try {
    const result = await request("/api/reports", {
      method: "POST",
      body: JSON.stringify({
        schoolId: draft.school.id,
        category: draft.category,
        description: draft.description,
      }),
    });
    state.reportDraft = null;
    saveReportId(result.report.id);
    sayLocalized(
      `रिपोर्ट दर्ज हो गई है। आपकी रिपोर्ट ID ${result.report.id} है। स्थिति “दर्ज हुई” है। आप इसे मेरी रिपोर्ट में देख सकते हैं।`,
      `Report submitted. Your report ID is ${result.report.id}. Status: Submitted. You can track it under My reports.`,
    );
    addReportIdCard(result.report.id);
    $("#report-id").value = result.report.id;
    await loadMyReports();
    await loadDashboard();
  } catch (error) {
    if (error.status === 409 && error.reportId) {
      state.reportDraft = null;
      sayLocalized(
        `ऐसी मिलती-जुलती रिपोर्ट पहले से मौजूद है। उसकी रिपोर्ट ID ${error.reportId} है।`,
        `A similar report already exists. Its report ID is ${error.reportId}.`,
      );
      addReportIdCard(error.reportId);
      return;
    }
    state.reportDraft = null;
    showError(error);
    sayLocalized(
      `रिपोर्ट दर्ज नहीं हो सकी: ${error.message} कृपया फिर से कोशिश करें।`,
      `The report could not be submitted: ${error.message} Please try again.`,
    );
  }
}

function saveReportId(id) {
  const ids = JSON.parse(localStorage.getItem("school360-report-ids") ?? "[]");
  if (!ids.includes(String(id))) ids.unshift(String(id));
  localStorage.setItem("school360-report-ids", JSON.stringify(ids.slice(0, 30)));
}

function isAffirmative(text) {
  return /^(हाँ|हां|जी|ठीक|करें|दर्ज करें|yes|yeah|yep|confirm)(?:\s|$|[.!?])/i.test(text.trim());
}

function isNegative(text) {
  return /^(नहीं|ना|मत करें|रद्द|no|cancel|stop)(?:\s|$|[.!?])/i.test(text.trim());
}

function relevantFacility(school, text) {
  const category = classifyCategory(text);
  const nameByCategory = {
    WATER: "Drinking Water",
    TOILETS: "Toilets",
    ELECTRICITY: "Electricity",
    CLASSROOM: "Classrooms",
    FURNITURE: "Furniture",
    CLEANLINESS: "Toilets",
  };
  return school.facilities.find((facility) =>
    facility.name === nameByCategory[category],
  ) ?? null;
}

async function handleReportStatus(text) {
  const id = text.match(/\b\d{1,18}\b/)?.[0];
  if (!id) {
    state.awaitingReportId = true;
    sayLocalized(
      "अपनी रिपोर्ट की संख्या वाली ID बताइए या मेरी रिपोर्ट में ID डालें।",
      "Tell me your numeric report ID, or enter it under My reports.",
    );
    return;
  }
  state.awaitingReportId = false;
  try {
    const { report } = await request(`/api/reports/${id}`);
    sayLocalized(
      `रिपोर्ट ${report.id} — ${report.school_name}। स्थिति: ${label("status", report.status)}। श्रेणी: ${label("category", report.category)}। दर्ज तारीख: ${dateLabel(report.created_at)}।`,
      `Report ${report.id} — ${report.school_name}. Status: ${label("status", report.status)}. Category: ${label("category", report.category)}. Submitted: ${dateLabel(report.created_at)}.`,
    );
    $("#report-id").value = report.id;
  } catch (error) {
    sayLocalized(
      error.status === 404 ? `रिपोर्ट ID ${id} नहीं मिली। कृपया ID जाँचें।` : `स्थिति नहीं मिल सकी: ${error.message}`,
      error.status === 404 ? `Report ID ${id} was not found. Please check the ID.` : `The status could not be retrieved: ${error.message}`,
    );
  }
}

async function processMessage(rawText) {
  const text = rawText.trim();
  if (!text) return;
  addMessage("user", text);
  voice.processing();

  if (state.reportDraft?.awaiting === "confirmation") {
    if (isAffirmative(text)) {
      await submitReport();
    } else if (isNegative(text)) {
      state.reportDraft = null;
      sayLocalized("ठीक है, रिपोर्ट दर्ज नहीं की गई।", "Okay. The report was not submitted.");
    } else {
      sayLocalized("क्या मैं यह रिपोर्ट दर्ज करूँ? हाँ कहें या नहीं।", "Should I submit this report? Say yes or no.");
    }
    return;
  }

  if (state.reportDraft?.awaiting === "school") {
    try {
      const matches = await searchSchoolList({ q: text });
      if (matches.length === 1) {
        state.reportDraft.school = await request(`/api/schools/${matches[0].id}`).then((result) => result.school);
        state.selectedSchool = state.reportDraft.school;
        askReportConfirmation();
      } else {
        sayLocalized(
          matches.length
            ? "मिलते-जुलते स्कूल नीचे दिखाए हैं। सही स्कूल चुनें।"
            : "इस नाम से स्कूल नहीं मिला। सूची में से स्कूल चुनें या दूसरा नाम लिखें।",
          matches.length
            ? "Matching schools are listed below. Choose the correct school."
            : "No school matched that name. Select one below or try another name.",
        );
        $("#schools").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      showError(error);
      sayLocalized(`स्कूल खोजा नहीं जा सका: ${error.message}`, `School search failed: ${error.message}`);
    }
    return;
  }

  if (state.awaitingReportId) {
    await handleReportStatus(text);
    return;
  }

  const intent = classifyIntent(text);
  if (intent === "REPORT_ISSUE") {
    setReportDraft({
      category: classifyCategory(text) ?? "OTHER",
      description: text,
    });
    if (state.reportDraft.school) askReportConfirmation();
    else askToSelectSchool();
    return;
  }
  if (intent === "CHECK_REPORT_STATUS") {
    await handleReportStatus(text);
    return;
  }
  if (intent === "GET_INFRASTRUCTURE_INFO") {
    if (!state.selectedSchool) {
      sayLocalized("किस स्कूल की सुविधा जाननी है? पहले स्कूल खोजें और चुनें.", "Which school's facilities should I check? Find and select a school first.");
      searchSchoolList().catch(showError);
      $("#schools").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    try {
      const { school } = await request(`/api/schools/${state.selectedSchool.id}`);
      const facility = relevantFacility(school, text);
      if (!facility) {
        sayLocalized(
          `${school.name} के उपलब्ध रिकॉर्ड में इस सुविधा की जानकारी नहीं है।`,
          `The available records do not include this facility for ${school.name}.`,
        );
      } else {
        sayLocalized(
          `${school.name} में ${label("facility", facility.name)} की स्थिति: ${conditionDescription(facility.condition_status, facility.verification_status)}।`,
          `${label("facility", facility.name)} at ${school.name}: ${conditionDescription(facility.condition_status, facility.verification_status)}.`,
        );
      }
    } catch (error) {
      showError(error);
      sayLocalized(`जानकारी नहीं मिल सकी: ${error.message}`, `Could not retrieve the information: ${error.message}`);
    }
    return;
  }
  if (intent === "SEARCH_SCHOOL") {
    const query = text.includes("कानपुर देहात")
      ? "Kanpur Dehat"
      : text.includes("कानपुर")
        ? "Kanpur Nagar"
        : /स्कूल|विद्यालय|school/i.test(text)
      ? text.replace(/मुझे|कृपया|जानकारी|चाहिए|खोजें|खोज|के|का|की|स्कूल|विद्यालय|school|find|search|information/gi, " ").trim()
      : text;
    try {
      const matches = await searchSchoolList({ q: query });
      sayLocalized(
        matches.length
          ? `${matches.length} स्कूल रिकॉर्ड मिले। सूची देखकर कोई स्कूल चुनें।`
          : "इस खोज में स्कूल नहीं मिला। ज़िला या स्कूल का नाम बदलकर कोशिश करें।",
        matches.length
          ? `${matches.length} school record(s) found. Choose a school from the list.`
          : "No school matched. Try another district or school name.",
      );
      $("#schools").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showError(error);
      sayLocalized(`स्कूल खोजा नहीं जा सका: ${error.message}`, `School search failed: ${error.message}`);
    }
    return;
  }
  sayLocalized(
    "मैं स्कूल खोजने, सुविधाओं की जानकारी देने, समस्या दर्ज करने और रिपोर्ट की स्थिति बताने में मदद कर सकता हूँ। आप किस स्कूल के बारे में जानना चाहते हैं?",
    "I can help find schools, check facility records, submit an issue, or track a report. What would you like to do?",
  );
}

function showError(error) {
  $("#voice-status").textContent = language === "en"
    ? error.message || "Could not connect to the service."
    : error.message || "सेवा से संपर्क नहीं हो सका।";
}

function renderReport(report) {
  const status = label("status", report.status);
  const verification = report.verification_status === "VERIFIED"
    ? text("सत्यापित", "Verified")
    : text("असत्यापित", "Unverified");
  return `<article class="report-card">
    <div class="report-card-header"><h3>${text("रिपोर्ट", "Report")} #${escapeHtml(report.id)}</h3>
      <span class="status-pill status-${escapeHtml(statusClass[report.status] ?? "submitted")}">${escapeHtml(status)}</span>
    </div>
    <p><strong>${escapeHtml(report.school_name)}</strong></p>
    <p>${escapeHtml(label("category", report.category))} · ${escapeHtml(report.description)}</p>
    <p>${text("दर्ज", "Submitted")}: ${escapeHtml(dateLabel(report.created_at))} · ${text("सत्यापन", "Verification")}: ${escapeHtml(verification)}</p>
  </article>`;
}

async function loadMyReports(requestedId = "") {
  const ids = JSON.parse(localStorage.getItem("school360-report-ids") ?? "[]");
  const wanted = requestedId ? [requestedId] : ids;
  const container = $("#my-report-results");
  if (!wanted.length) {
    container.innerHTML = `<p class="empty-state">${text("अभी इस ब्राउज़र में कोई रिपोर्ट दर्ज नहीं है।", "No reports have been submitted from this browser yet.")}</p>`;
    return;
  }
  const reports = await Promise.all(wanted.map(async (id) => {
    try {
      return (await request(`/api/reports/${encodeURIComponent(id)}`)).report;
    } catch (error) {
      return { id, error: error.message };
    }
  }));
  container.innerHTML = reports.map((report) => report.error
    ? `<p class="empty-state">${text("रिपोर्ट", "Report")} #${escapeHtml(report.id)}: ${escapeHtml(report.error)}</p>`
    : renderReport(report)).join("");
}

function populateFilters() {
  $("#admin-category-filter").innerHTML = `<option value="">${text("सभी श्रेणियाँ", "All categories")}</option>`
    + categoryOptions.map((category) => `<option value="${category}">${label("category", category)}</option>`).join("");
  $("#admin-status-filter").innerHTML = `<option value="">${text("सभी स्थितियाँ", "All statuses")}</option>`
    + statusOptions.map((status) => `<option value="${status}">${label("status", status)}</option>`).join("");
}

function populateSchoolFilters() {
  const districtFilter = $("#district-filter");
  const selectedDistrict = districtFilter.value;
  const districts = Array.from(districtFilter.options).slice(1).map((option) => option.value);
  districtFilter.innerHTML = `<option value="">${text("सभी ज़िले", "All districts")}</option>`
    + districts.map((district) => `<option value="${escapeHtml(district)}">${escapeHtml(locationLabel(district))}</option>`).join("");
  districtFilter.value = selectedDistrict;

  const typeFilter = $("#type-filter");
  const selectedType = typeFilter.value;
  const types = Array.from(typeFilter.options).slice(1).map((option) => option.value);
  typeFilter.innerHTML = `<option value="">${text("सभी प्रकार", "All types")}</option>`
    + types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(schoolTypeLabel(type))}</option>`).join("");
  typeFilter.value = selectedType;
}

function renderAdminReports(reports) {
  const container = $("#admin-reports");
  if (!reports.length) {
    container.innerHTML = `<p class="empty-state">${text("इस फ़िल्टर में अभी कोई रिपोर्ट नहीं है।", "No reports match these filters.")}</p>`;
    return;
  }
  container.innerHTML = reports.map((report) => `<div class="admin-report-row" data-report="${escapeHtml(report.id)}">
    <div><strong>#${escapeHtml(report.id)} · ${escapeHtml(report.school_name)}</strong>
      <span>${escapeHtml(label("category", report.category))} — ${escapeHtml(report.description)}</span></div>
    <select aria-label="${text("रिपोर्ट", "Report")} #${escapeHtml(report.id)} ${text("की नई स्थिति", "new status")}">
      ${statusOptions.map((status) => `<option value="${status}" ${status === report.status ? "selected" : ""}>${label("status", status)}</option>`).join("")}
    </select>
    <button type="button" data-update="${escapeHtml(report.id)}">${text("अपडेट", "Update")}</button>
  </div>`).join("");
  container.querySelectorAll("[data-update]").forEach((button) => {
    button.addEventListener("click", () => updateAdminReport(button.dataset.update));
  });
}

async function loadDashboard() {
  const params = new URLSearchParams();
  const schoolId = $("#admin-school-filter").value.trim();
  const category = $("#admin-category-filter").value;
  const status = $("#admin-status-filter").value;
  if (schoolId) params.set("schoolId", schoolId);
  if (category) params.set("category", category);
  if (status) params.set("status", status);
  try {
    const { dashboard } = await request(`/api/admin/dashboard?${params}`);
    $("#dashboard-stats").innerHTML = [
      [text("कुल स्कूल", "Total schools"), dashboard.totalSchools],
      [text("कुल रिपोर्ट", "Total reports"), dashboard.totalReports],
      [text("लंबित रिपोर्ट", "Pending reports"), dashboard.pendingReports],
      [text("समाधान हुआ", "Resolved"), dashboard.resolvedReports],
    ].map(([label, count]) => `<article class="stat-card"><span>${label}</span><strong>${escapeHtml(count)}</strong></article>`).join("");
    const max = Math.max(1, ...dashboard.reportsByCategory.map((row) => row.count));
    $("#category-stats").innerHTML = dashboard.reportsByCategory.length
      ? dashboard.reportsByCategory.map((row) => `<div class="category-line">
          <span>${escapeHtml(label("category", row.category))}</span><strong>${escapeHtml(row.count)}</strong>
          <div class="bar-track"><div class="bar-fill bar-width-${Math.round(row.count / max * 10) * 10}"></div></div>
        </div>`).join("")
      : `<p class="empty-state">${text("अभी कोई रिपोर्ट नहीं है।", "There are no reports yet.")}</p>`;
    renderAdminReports(dashboard.recentReports);
  } catch (error) {
    $("#dashboard-stats").innerHTML = `<p class="empty-state">${text("डैशबोर्ड लोड नहीं हुआ", "Dashboard could not load")}: ${escapeHtml(error.message)}</p>`;
    $("#category-stats").replaceChildren();
    $("#admin-reports").replaceChildren();
  }
}

async function updateAdminReport(id) {
  const row = $(`[data-report="${CSS.escape(String(id))}"]`);
  const password = $("#admin-password").value;
  if (!password) {
    $("#admin-message").textContent = text("पहले प्रशासन पासवर्ड दर्ज करें।", "Enter the admin password first.");
    return;
  }
  try {
    const status = row.querySelector("select").value;
    const { report } = await request(`/api/admin/reports/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      headers: { "x-admin-password": password },
      body: JSON.stringify({ status }),
    });
    $("#admin-message").textContent = text(
      `रिपोर्ट #${report.id} की स्थिति अपडेट हुई।`,
      `Report #${report.id} status updated.`,
    );
    await loadDashboard();
    await loadMyReports(String(id));
  } catch (error) {
    $("#admin-message").textContent = text(
      `स्थिति अपडेट नहीं हुई: ${error.message}`,
      `Status was not updated: ${error.message}`,
    );
  }
}

function setLanguage(nextLanguage) {
  language = nextLanguage;
  localStorage.setItem("school360-language", language);
  applyStaticTranslations(language);
  const toggle = $("#language-toggle");
  toggle.textContent = language === "hi" ? "English" : "हिंदी";
  toggle.setAttribute("aria-label", text("Switch to English", "भाषा हिंदी में बदलें"));
  voice.setLanguage(language);
  populateSchoolFilters();
  populateFilters();
  showSchoolResults(state.schools);
  if (state.selectedSchool && !$("#school-detail").hidden) {
    renderSchoolDetail(state.selectedSchool);
  }
  loadMyReports().catch(showError);
  loadDashboard();
}

$("#mic-button").addEventListener("click", () => voice.start());
$("#language-toggle").addEventListener("click", () => {
  setLanguage(language === "hi" ? "en" : "hi");
});
$("#chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("#chat-message");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  processMessage(text);
});
$("#school-search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await searchSchoolList({
      q: $("#school-query").value,
      district: $("#district-filter").value,
      type: $("#type-filter").value,
    });
  } catch (error) {
    showError(error);
    showSchoolResults([], text(
      `स्कूल खोजा नहीं जा सका: ${error.message}`,
      `School search failed: ${error.message}`,
    ));
  }
});
$("#school-results").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-school-id]");
  if (!button) return;
  try {
    await loadSchoolDetail(button.dataset.schoolId);
    if (state.reportDraft?.awaiting === "school") {
      state.reportDraft.school = state.selectedSchool;
      askReportConfirmation();
    }
  } catch (error) {
    showError(error);
  }
});
$("#report-lookup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#report-id").value.trim();
  if (!/^[1-9]\d{0,17}$/.test(id)) {
    $("#my-report-results").innerHTML = `<p class="empty-state">${text("कृपया सही रिपोर्ट ID डालें।", "Enter a valid report ID.")}</p>`;
    return;
  }
  try {
    await loadMyReports(id);
  } catch (error) {
    $("#my-report-results").innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  }
});
$("#refresh-admin").addEventListener("click", loadDashboard);
$("#admin-category-filter").addEventListener("change", loadDashboard);
$("#admin-status-filter").addEventListener("change", loadDashboard);
$("#admin-school-filter").addEventListener("change", loadDashboard);

applyStaticTranslations(language);
$("#language-toggle").textContent = language === "hi" ? "English" : "हिंदी";
$("#language-toggle").setAttribute("aria-label", text("Switch to English", "भाषा हिंदी में बदलें"));
voice.setLanguage(language);
populateSchoolFilters();
populateFilters();
searchSchoolList().catch((error) => {
  showSchoolResults([], text(
    `स्कूल खोज सेवा उपलब्ध नहीं: ${error.message}`,
    `School search is unavailable: ${error.message}`,
  ));
});
loadDashboard();
loadMyReports();
