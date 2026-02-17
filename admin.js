const ADMIN_KEY_STORAGE = "sus_admin_key_v1";
const METRICS = ["Calories", "Protein", "Carbs", "Fat", "Fiber"];

const passwordInput = document.getElementById("admin-password");
const loadBtn = document.getElementById("load-btn");
const clearAuthBtn = document.getElementById("clear-auth-btn");
const addOptionBtn = document.getElementById("add-option-btn");
const saveBtn = document.getElementById("save-btn");
const statusEl = document.getElementById("status");
const optionsWrap = document.getElementById("options-wrap");
const resetVotesCheckbox = document.getElementById("reset-votes");

let config = {
  pollOptions: [],
  nutrition: {}
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
    meat: { Calories: "", Protein: "", Carbs: "", Fat: "", Fiber: "" },
    veggie: { Calories: "", Protein: "", Carbs: "", Fat: "", Fiber: "" }
  };
}

function renderOptions() {
  optionsWrap.innerHTML = "";

  config.pollOptions.forEach((option, index) => {
    const nutrition = config.nutrition[option] || emptyNutrition();

    const card = document.createElement("article");
    card.className = "option-card";
    card.innerHTML = `
      <div class="row" style="justify-content:space-between; align-items:center;">
        <strong>Option ${index + 1}</strong>
        <button class="btn-light remove-option-btn" data-index="${index}">Remove</button>
      </div>
      <div class="stack" style="margin-top:8px;">
        <label>
          <span class="muted">Meal Name</span>
          <input class="option-name" data-index="${index}" value="${option}" />
        </label>
        <div class="grid-2">
          <div class="stack">
            <strong>With Meat</strong>
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
      config.pollOptions.splice(idx, 1);
      delete config.nutrition[optionName];
      renderOptions();
    });
  });
}

function collectFormData() {
  const names = Array.from(document.querySelectorAll(".option-name")).map((input) => input.value.trim());
  const nutrition = {};

  names.forEach((name, idx) => {
    nutrition[name] = { meat: {}, veggie: {} };
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
    nutrition
  };
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
      nutrition: data.nutrition
    };

    saveAdminKeyLocally();
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
  if (payload.pollOptions.length < 2) {
    setStatus("warn", "Add at least 2 poll options.");
    return;
  }

  if (payload.pollOptions.some((n) => !n)) {
    setStatus("warn", "Option names cannot be empty.");
    return;
  }

  const lowerNames = payload.pollOptions.map((n) => n.toLowerCase());
  if (new Set(lowerNames).size !== payload.pollOptions.length) {
    setStatus("warn", "Option names must be unique.");
    return;
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
      nutrition: data.config.nutrition
    };

    saveAdminKeyLocally();
    renderOptions();
    setStatus("ok", data.message || "Settings saved.");
  } catch (err) {
    setStatus("warn", err.message);
  }
}

function addOption() {
  const next = `New Meal ${config.pollOptions.length + 1}`;
  config.pollOptions.push(next);
  config.nutrition[next] = emptyNutrition();
  renderOptions();
}

function init() {
  loadSavedAdminKey();
  loadBtn.addEventListener("click", loadConfig);
  clearAuthBtn.addEventListener("click", clearSavedAdminKey);
  addOptionBtn.addEventListener("click", addOption);
  saveBtn.addEventListener("click", saveConfig);
}

init();
