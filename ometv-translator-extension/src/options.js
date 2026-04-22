import { getSettings, saveSettings } from "./storage.js";

const form = document.querySelector("#settings-form");
const status = document.querySelector("#status");

const FIELDS = [
  "enabled",
  "apiBaseUrl",
  "apiKey",
  "model",
  "nativeLanguage",
  "translateIncoming",
  "translateOutgoing",
  "showOriginalText",
  "autoPlayTranslatedSpeech",
  "debugMode"
];

bootstrap();

async function bootstrap() {
  const settings = await getSettings();
  applyToForm(settings);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const nextSettings = collectFromForm();
  await saveSettings(nextSettings);

  status.textContent = "Saved. Reload the OmeTV tab if it is already open.";
  setTimeout(() => {
    status.textContent = "";
  }, 2500);
});

function applyToForm(settings) {
  for (const fieldName of FIELDS) {
    const field = document.querySelector(`#${fieldName}`);

    if (!field) {
      continue;
    }

    if (field.type === "checkbox") {
      field.checked = Boolean(settings[fieldName]);
    } else {
      field.value = settings[fieldName] ?? "";
    }
  }
}

function collectFromForm() {
  return FIELDS.reduce((accumulator, fieldName) => {
    const field = document.querySelector(`#${fieldName}`);

    if (!field) {
      return accumulator;
    }

    accumulator[fieldName] = field.type === "checkbox" ? field.checked : field.value.trim();
    return accumulator;
  }, {});
}
