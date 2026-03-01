const ADMIN_KEY_STORAGE = "sus_admin_key_v1";
const METRICS = ["Calories", "Protein", "Carbs", "Fat", "Fiber"];

const passwordInput = document.getElementById("admin-password");
const loadBtn = document.getElementById("load-btn");
const clearAuthBtn = document.getElementById("clear-auth-btn");
const addOptionBtn = document.getElementById("add-option-btn");
const saveBtn = document.getElementById("save-btn");
const resetDefaultsBtn = document.getElementById("reset-defaults-btn");
const statusEl = document.getElementById("status");
const optionsWrap = document.getElementById("options-wrap");
const resetVotesCheckbox = document.getElementById("reset-votes");
const resetSuggestionsDefaultsCheckbox = document.getElementById("reset-suggestions-defaults");
const optionCountEl = document.getElementById("option-count");
const uiSiteTitle = document.getElementById("ui-site-title");
const uiHeroSubtitle = document.getElementById("ui-hero-subtitle");
const uiAdminLinkText = document.getElementById("ui-admin-link-text");
const uiPollTitle = document.getElementById("ui-poll-title");
const uiPollNote = document.getElementById("ui-poll-note");
const uiNutritionTitle = document.getElementById("ui-nutrition-title");
const uiNutritionNote = document.getElementById("ui-nutrition-note");
const uiNutritionChooseLabel = document.getElementById("ui-nutrition-choose-label");
const uiVegetarianHeader = document.getElementById("ui-vegetarian-header");
const uiSuggestTitle = document.getElementById("ui-suggest-title");
const uiSuggestNote = document.getElementById("ui-suggest-note");
const uiSuggestPlaceholder = document.getElementById("ui-suggest-placeholder");
const uiSuggestButtonText = document.getElementById("ui-suggest-button-text");
const uiRecentSuggestionsLabel = document.getElementById("ui-recent-suggestions-label");
const uiShowHero = document.getElementById("ui-show-hero");
const uiShowPoll = document.getElementById("ui-show-poll");
const uiShowNutrition = document.getElementById("ui-show-nutrition");
const uiShowSuggestion = document.getElementById("ui-show-suggestion");

const DEFAULT_UI = {
  showHero: true,
  showPoll: true,
  showNutrition: true,
  showSuggestion: true,
  siteTitle: "School Dinner Choice Hub",
  heroSubtitle: "No sign-in needed. This device can vote once and suggest once per day.",
  adminLinkText: "Admin Settings",
  pollTitle: "1) Vote For Next Vegetarian Dinner",
  pollNote: "Live split updates every 5 seconds.",
  nutritionTitle: "2) Nutrition: Meat vs Vegetarian",
  nutritionNote: "Compare calories, protein, carbs, fat, and fiber.",
  nutritionChooseLabel: "Choose meal:",
  vegetarianHeader: "Vegetarian Option",
  suggestTitle: "3) Suggest A Meal For The Next Poll",
  suggestNote: "One suggestion per day per device.",
  suggestPlaceholder: "Example: Spinach lasagna with roasted vegetables",
  suggestButtonText: "Submit Suggestion",
  recentSuggestionsLabel: "Recent suggestions:"
};

let config = {
  pollOptions: [],
  nutrition: {},
  ui: { ...DEFAULT_UI }
};

function setStatus(type, text) {
  statusEl.className = `status ${type}`;
  statusEl.textContent = text;
}

function getAdminKey() {
  return passwordInput.value.trim();
}

function adminHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Admin-Key": getAdminKey()
  };
}

function saveAdminKeyLocally() {
  const key = getAdminKey();
  if (key) {
    localStorage.setItem(ADMIN_KEY_STORAGE, key);
  }
}

function loadSavedAdminKey() {
  const key = localStorage.getItem(ADMIN_KEY_STORAGE);
  if (key) {
    passwordInput.value = key;
  }
}

function clearSavedAdminKey() {
  localStorage.removeItem(ADMIN_KEY_STORAGE);
  passwordInput.value = "";
  setStatus("warn", "Saved password cleared.");
}

function emptyNutrition() {
  return {
    shownMetrics: [...METRICS],
    meatLabel: "With Meat",
    meat: { Calories: "", Protein: "", Carbs: "", Fat: "", Fiber: "" },
    veggie: { Calories: "", Protein: "", Carbs: "", Fat: "", Fiber: "" }
  };
}

function renderOptions() {
  optionsWrap.innerHTML = "";
  optionCountEl.textContent = `Current boxes: ${config.pollOptions.length}`;

  if (!config.pollOptions.length) {
    optionsWrap.innerHTML = `<p class="muted">No meal boxes currently. Click <strong>Add Meal Box</strong> to create one.</p>`;
    return;
  }

  config.pollOptions.forEach((option, index) => {
    const nutrition = { ...emptyNutrition(), ...(config.nutrition[option] || {}) };
    const shownMetrics = Array.isArray(nutrition.shownMetrics) ? nutrition.shownMetrics : [...METRICS];

    const card = document.createElement("article");
    card.className = "option-card";
    card.innerHTML = `
      <div class="row" style="justify-content:space-between; align-items:center;">
        <strong>Option ${index + 1}</strong>
        <button class="btn-light remove-option-btn" data-index="${index}">Delete This Box</button>
      </div>
      <div class="stack" style="margin-top:8px;">
        <label>
          <span class="muted">Meal Name</span>
          <input class="option-name" data-index="${index}" value="${option}" />
        </label>
        <label>
          <span class="muted">Meat Label For This Option (example: Chicken, Steak)</span>
          <input class="meat-label" data-index="${index}" value="${nutrition.meatLabel ?? "With Meat"}" />
        </label>
        <label>
          <span class="muted">Nutrition rows to display for this meal</span>
          <div class="row">
            ${METRICS.map(
              (metric) => `
              <label>
                <input class="shown-metric" data-index="${index}" data-metric="${metric}" type="checkbox" ${shownMetrics.includes(metric) ? "checked" : ""} />
                ${metric}
              </label>
            `
            ).join("")}
          </div>
        </label>
        <div class="grid-2">
          <div class="stack">
            <strong>${nutrition.meatLabel ?? "With Meat"}</strong>
            ${METRICS.map(
              (metric) => `
              <label>
                <span class="muted">${metric}</span>
                <input class="nutrient" data-index="${index}" data-side="meat" data-metric="${metric}" value="${nutrition.meat[metric] ?? ""}" />
              </label>
            `
            ).join("")}
          </div>
          <div class="stack">
            <strong>Vegetarian</strong>
            ${METRICS.map(
              (metric) => `
              <label>
                <span class="muted">${metric}</span>
                <input class="nutrient" data-index="${index}" data-side="veggie" data-metric="${metric}" value="${nutrition.veggie[metric] ?? ""}" />
              </label>
            `
            ).join("")}
          </div>
        </div>
      </div>
    `;

    optionsWrap.appendChild(card);
  });

  optionsWrap.querySelectorAll(".remove-option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      const optionName = config.pollOptions[idx];
      const confirmed = window.confirm(`Delete this option box: "${optionName}"?`);
      if (!confirmed) return;
      config.pollOptions.splice(idx, 1);
      delete config.nutrition[optionName];
      renderOptions();
      setStatus("ok", "Option box deleted. Click Save Settings to apply.");
    });
  });
}

function collectFormData() {
  const names = Array.from(document.querySelectorAll(".option-name")).map((input) => input.value.trim());
  const nutrition = {};

  names.forEach((name, idx) => {
    const meatLabelInput = document.querySelector(`.meat-label[data-index="${idx}"]`);
    const shownMetricInputs = Array.from(
      document.querySelectorAll(`.shown-metric[data-index="${idx}"]`)
    );
    nutrition[name] = {
      meatLabel: ((meatLabelInput?.value || "").trim() || "With Meat"),
      shownMetrics: shownMetricInputs.filter((el) => el.checked).map((el) => el.dataset.metric),
      meat: {},
      veggie: {}
    };
    METRICS.forEach((metric) => {
      const meatInput = document.querySelector(
        `.nutrient[data-index="${idx}"][data-side="meat"][data-metric="${metric}"]`
      );
      const veggieInput = document.querySelector(
        `.nutrient[data-index="${idx}"][data-side="veggie"][data-metric="${metric}"]`
      );
      nutrition[name].meat[metric] = (meatInput?.value || "").trim();
      nutrition[name].veggie[metric] = (veggieInput?.value || "").trim();
    });
  });

  return {
    pollOptions: names,
    nutrition,
    ui: {
      showHero: Boolean(uiShowHero.checked),
      showPoll: Boolean(uiShowPoll.checked),
      showNutrition: Boolean(uiShowNutrition.checked),
      showSuggestion: Boolean(uiShowSuggestion.checked),
      siteTitle: (uiSiteTitle.value || "").trim(),
      heroSubtitle: (uiHeroSubtitle.value || "").trim(),
      adminLinkText: (uiAdminLinkText.value || "").trim(),
      pollTitle: (uiPollTitle.value || "").trim(),
      pollNote: (uiPollNote.value || "").trim(),
      nutritionTitle: (uiNutritionTitle.value || "").trim(),
      nutritionNote: (uiNutritionNote.value || "").trim(),
      nutritionChooseLabel: (uiNutritionChooseLabel.value || "").trim(),
      vegetarianHeader: (uiVegetarianHeader.value || "").trim(),
      suggestTitle: (uiSuggestTitle.value || "").trim(),
      suggestNote: (uiSuggestNote.value || "").trim(),
      suggestPlaceholder: (uiSuggestPlaceholder.value || "").trim(),
      suggestButtonText: (uiSuggestButtonText.value || "").trim(),
      recentSuggestionsLabel: (uiRecentSuggestionsLabel.value || "").trim()
    }
  };
}

function fillUiForm(ui) {
  const merged = { ...DEFAULT_UI, ...(ui || {}) };
  uiShowHero.checked = Boolean(merged.showHero);
  uiShowPoll.checked = Boolean(merged.showPoll);
  uiShowNutrition.checked = Boolean(merged.showNutrition);
  uiShowSuggestion.checked = Boolean(merged.showSuggestion);
  uiSiteTitle.value = merged.siteTitle;
  uiHeroSubtitle.value = merged.heroSubtitle;
  uiAdminLinkText.value = merged.adminLinkText;
  uiPollTitle.value = merged.pollTitle;
  uiPollNote.value = merged.pollNote;
  uiNutritionTitle.value = merged.nutritionTitle;
  uiNutritionNote.value = merged.nutritionNote;
  uiNutritionChooseLabel.value = merged.nutritionChooseLabel;
  uiVegetarianHeader.value = merged.vegetarianHeader;
  uiSuggestTitle.value = merged.suggestTitle;
  uiSuggestNote.value = merged.suggestNote;
  uiSuggestPlaceholder.value = merged.suggestPlaceholder;
  uiSuggestButtonText.value = merged.suggestButtonText;
  uiRecentSuggestionsLabel.value = merged.recentSuggestionsLabel;
}

async function loadConfig() {
  if (!getAdminKey()) {
    setStatus("warn", "Enter admin password first.");
    return;
  }

  try {
    const res = await fetch("/api/admin/config", {
      headers: {
        "X-Admin-Key": getAdminKey()
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load config");

    config = {
      pollOptions: data.pollOptions,
      nutrition: data.nutrition,
      ui: { ...DEFAULT_UI, ...(data.ui || {}) }
    };

    saveAdminKeyLocally();
    fillUiForm(config.ui);
    renderOptions();
    setStatus("ok", "Loaded current settings.");
  } catch (err) {
    setStatus("warn", err.message);
  }
}

async function saveConfig() {
  if (!getAdminKey()) {
    setStatus("warn", "Enter admin password first.");
    return;
  }

  const payload = collectFormData();
  if (payload.pollOptions.some((n) => !n)) {
    setStatus("warn", "Option names cannot be empty.");
    return;
  }

  const lowerNames = payload.pollOptions.map((n) => n.toLowerCase());
  if (new Set(lowerNames).size !== payload.pollOptions.length) {
    setStatus("warn", "Option names must be unique.");
    return;
  }

  for (const optionName of payload.pollOptions) {
    const shown = payload.nutrition[optionName]?.shownMetrics || [];
    if (!shown.length) {
      setStatus("warn", `Choose at least one visible nutrition row for "${optionName}".`);
      return;
    }
  }

  try {
    const res = await fetch("/api/admin/config", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        ...payload,
        resetVotes: resetVotesCheckbox.checked
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save settings");

    config = {
      pollOptions: data.config.pollOptions,
      nutrition: data.config.nutrition,
      ui: { ...DEFAULT_UI, ...(data.config.ui || {}) }
    };

    saveAdminKeyLocally();
    fillUiForm(config.ui);
    renderOptions();
    setStatus("ok", data.message || "Settings saved.");
  } catch (err) {
    setStatus("warn", err.message);
  }
}

async function resetToDefaults() {
  if (!getAdminKey()) {
    setStatus("warn", "Enter admin password first.");
    return;
  }

  const confirmed = window.confirm(
    "Reset all website settings to defaults? This will overwrite custom text, boxes, and nutrition setup."
  );
  if (!confirmed) return;

  try {
    const res = await fetch("/api/admin/reset", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        resetVotes: true,
        resetSuggestions: Boolean(resetSuggestionsDefaultsCheckbox.checked)
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not reset defaults");

    config = {
      pollOptions: data.config.pollOptions,
      nutrition: data.config.nutrition,
      ui: { ...DEFAULT_UI, ...(data.config.ui || {}) }
    };
    fillUiForm(config.ui);
    renderOptions();
    setStatus("ok", data.message || "Defaults restored.");
  } catch (err) {
    setStatus("warn", err.message);
  }
}

function addOption() {
  const next = `New Meal ${config.pollOptions.length + 1}`;
  config.pollOptions.push(next);
  config.nutrition[next] = emptyNutrition();
  renderOptions();
  setStatus("ok", "New option box added. Fill it in, then click Save Settings.");
}

function init() {
  loadSavedAdminKey();
  fillUiForm(DEFAULT_UI);
  loadBtn.addEventListener("click", loadConfig);
  clearAuthBtn.addEventListener("click", clearSavedAdminKey);
  addOptionBtn.addEventListener("click", addOption);
  saveBtn.addEventListener("click", saveConfig);
  resetDefaultsBtn.addEventListener("click", resetToDefaults);
}

init();
