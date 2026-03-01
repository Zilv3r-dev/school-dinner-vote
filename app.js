const DEVICE_ID_KEY = "sus_device_id_v1";
const REFRESH_MS = 5000;

let state = {
  pollOptions: [],
  pollCounts: {},
  totalVotes: 0,
  userVote: null,
  nutrition: {},
  ui: {},
  suggestionAllowed: null,
  recentSuggestions: []
};

const pollOptionsWrap = document.getElementById("poll-options");
const voteStatus = document.getElementById("vote-status");
const mealSelect = document.getElementById("meal-select");
const meatHeader = document.getElementById("meat-header");
const vegetarianHeader = document.getElementById("vegetarian-header");
const nutritionBody = document.getElementById("nutrition-body");
const suggestInput = document.getElementById("suggest-input");
const suggestButton = document.getElementById("suggest-btn");
const suggestStatus = document.getElementById("suggest-status");
const suggestList = document.getElementById("suggest-list");
const heroSection = document.getElementById("hero-section");
const pollSection = document.getElementById("poll-section");
const nutritionSection = document.getElementById("nutrition-section");
const suggestionSection = document.getElementById("suggestion-section");
const siteTitle = document.getElementById("site-title");
const heroSubtitle = document.getElementById("hero-subtitle");
const adminLinkText = document.getElementById("admin-link-text");
const pollTitle = document.getElementById("poll-title");
const pollNote = document.getElementById("poll-note");
const nutritionTitle = document.getElementById("nutrition-title");
const nutritionNote = document.getElementById("nutrition-note");
const nutritionChooseLabel = document.getElementById("nutrition-choose-label");
const suggestTitle = document.getElementById("suggest-title");
const suggestNote = document.getElementById("suggest-note");
const recentSuggestionsLabel = document.getElementById("recent-suggestions-label");

function setStatus(el, type, text) {
  el.className = `status ${type}`;
  el.textContent = text;
}

function applyUiConfig() {
  const ui = state.ui || {};

  if (siteTitle) siteTitle.textContent = ui.siteTitle || "School Dinner Choice Hub";
  if (heroSubtitle) {
    heroSubtitle.textContent =
      ui.heroSubtitle || "No sign-in needed. This device can vote once and suggest once per day.";
  }
  if (adminLinkText) adminLinkText.textContent = ui.adminLinkText || "Admin Settings";
  if (pollTitle) pollTitle.textContent = ui.pollTitle || "1) Vote For Next Vegetarian Dinner";
  if (pollNote) pollNote.textContent = ui.pollNote || "Live split updates every 5 seconds.";
  if (nutritionTitle) nutritionTitle.textContent = ui.nutritionTitle || "2) Nutrition: Meat vs Vegetarian";
  if (nutritionNote) nutritionNote.textContent = ui.nutritionNote || "Compare calories, protein, carbs, fat, and fiber.";
  if (nutritionChooseLabel) nutritionChooseLabel.textContent = ui.nutritionChooseLabel || "Choose meal:";
  if (vegetarianHeader) vegetarianHeader.textContent = ui.vegetarianHeader || "Vegetarian Option";
  if (suggestTitle) suggestTitle.textContent = ui.suggestTitle || "3) Suggest A Meal For The Next Poll";
  if (suggestNote) suggestNote.textContent = ui.suggestNote || "One suggestion per day per device.";
  if (suggestInput) suggestInput.placeholder = ui.suggestPlaceholder || "Example: Spinach lasagna with roasted vegetables";
  if (suggestButton) suggestButton.textContent = ui.suggestButtonText || "Submit Suggestion";
  if (recentSuggestionsLabel) recentSuggestionsLabel.textContent = ui.recentSuggestionsLabel || "Recent suggestions:";

  if (heroSection) heroSection.style.display = ui.showHero === false ? "none" : "";
  if (pollSection) pollSection.style.display = ui.showPoll === false ? "none" : "";
  if (nutritionSection) nutritionSection.style.display = ui.showNutrition === false ? "none" : "";
  if (suggestionSection) suggestionSection.style.display = ui.showSuggestion === false ? "none" : "";
}

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (id) return id;

  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    id = window.crypto.randomUUID();
  } else {
    id = `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

async function apiGet(path) {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.code = res.status;
    throw err;
  }
  return data;
}

async function apiPost(path, payload) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.code = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function renderPoll() {
  pollOptionsWrap.innerHTML = "";
  const total = state.totalVotes;

  if (!state.pollOptions.length) {
    setStatus(voteStatus, "warn", "No poll options are currently available.");
    return;
  }

  state.pollOptions.forEach((option) => {
    const count = state.pollCounts[option] || 0;
    const pct = total === 0 ? 0 : Math.round((count / total) * 100);

    const optionNode = document.createElement("article");
    optionNode.className = "option";
    optionNode.innerHTML = `
      <div class="option-header">
        <p class="option-title">${option}</p>
        <button class="vote-btn" data-option="${option}" ${state.userVote ? "disabled" : ""}>
          ${state.userVote ? "Vote Locked" : "Vote"}
        </button>
      </div>
      <div class="meter" aria-hidden="true">
        <div class="meter-fill" style="width:${pct}%"></div>
      </div>
      <p class="split">${count} vote${count === 1 ? "" : "s"} (${pct}%)</p>
    `;

    pollOptionsWrap.appendChild(optionNode);
  });

  pollOptionsWrap.querySelectorAll(".vote-btn").forEach((button) => {
    button.addEventListener("click", () => submitVote(button.dataset.option));
  });

  if (state.userVote) {
    setStatus(voteStatus, "ok", `Vote recorded for ${state.userVote}. This device is now locked.`);
  } else {
    setStatus(voteStatus, "warn", "This device has not voted yet.");
  }
}

function renderNutritionSelector() {
  if (!state.pollOptions.length) {
    mealSelect.innerHTML = "";
    nutritionBody.innerHTML = "";
    meatHeader.textContent = "With Meat";
    return;
  }

  const current = mealSelect.value;
  mealSelect.innerHTML = "";

  state.pollOptions.forEach((option) => {
    const node = document.createElement("option");
    node.value = option;
    node.textContent = option;
    mealSelect.appendChild(node);
  });

  if (current && state.pollOptions.includes(current)) {
    mealSelect.value = current;
  }

  renderNutritionTable(mealSelect.value || state.pollOptions[0]);
}

function renderNutritionTable(mealName) {
  nutritionBody.innerHTML = "";
  const meal = state.nutrition[mealName];
  if (!meal) {
    meatHeader.textContent = "With Meat";
    return;
  }
  meatHeader.textContent = meal.meatLabel || "With Meat";

  ["Calories", "Protein", "Carbs", "Fat", "Fiber"].forEach((metric) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${metric}</td>
      <td>${meal.meat[metric]}</td>
      <td>${meal.veggie[metric]}</td>
    `;
    nutritionBody.appendChild(row);
  });
}

function renderSuggestions() {
  suggestList.innerHTML = "";

  if (!state.recentSuggestions.length) {
    const empty = document.createElement("li");
    empty.textContent = "No suggestions yet.";
    suggestList.appendChild(empty);
  } else {
    state.recentSuggestions.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = `${item.date}: ${item.text}`;
      suggestList.appendChild(li);
    });
  }

  if (state.suggestionAllowed) {
    suggestButton.disabled = false;
    setStatus(suggestStatus, "warn", "You can submit one suggestion today from this device.");
  } else {
    suggestButton.disabled = true;
    setStatus(suggestStatus, "ok", "This device already submitted a suggestion today.");
  }
}

async function submitVote(option) {
  if (!state.pollOptions.length) {
    setStatus(voteStatus, "warn", "No poll options are currently available.");
    return;
  }

  try {
    await apiPost("/api/vote", { device_id: getOrCreateDeviceId(), option });
    await loadBootstrap();
  } catch (err) {
    if (err.code === 409 && err.data?.userVote) {
      setStatus(voteStatus, "ok", `Vote already recorded for ${err.data.userVote}.`);
      await loadBootstrap();
      return;
    }
    setStatus(voteStatus, "warn", err.message);
  }
}

async function submitSuggestion() {
  const text = suggestInput.value.trim();
  if (!text) {
    setStatus(suggestStatus, "warn", "Type a meal suggestion first.");
    return;
  }

  try {
    await apiPost("/api/suggestion", { device_id: getOrCreateDeviceId(), text });
    suggestInput.value = "";
    await loadBootstrap();
  } catch (err) {
    setStatus(suggestStatus, "warn", err.message);
    await loadBootstrap();
  }
}

async function loadBootstrap() {
  const deviceId = encodeURIComponent(getOrCreateDeviceId());

  try {
    const data = await apiGet(`/api/bootstrap?device_id=${deviceId}`);
    state = {
      pollOptions: data.pollOptions,
      pollCounts: data.pollCounts,
      totalVotes: data.totalVotes,
      userVote: data.userVote,
      nutrition: data.nutrition,
      ui: data.ui || {},
      suggestionAllowed: Boolean(data.suggestionAllowed),
      recentSuggestions: data.recentSuggestions
    };

    applyUiConfig();
    renderPoll();
    renderNutritionSelector();
    renderSuggestions();
  } catch (err) {
    setStatus(voteStatus, "warn", `Error: ${err.message}`);
    setStatus(suggestStatus, "warn", `Error: ${err.message}`);
  }
}

function init() {
  mealSelect.addEventListener("change", () => renderNutritionTable(mealSelect.value));
  suggestButton.addEventListener("click", submitSuggestion);

  loadBootstrap();
  setInterval(loadBootstrap, REFRESH_MS);
}

init();
