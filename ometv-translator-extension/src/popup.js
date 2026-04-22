import { getSettings } from "./storage.js";

const summary = document.querySelector("#summary");
const openOptionsButton = document.querySelector("#open-options");

bootstrap();

openOptionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

async function bootstrap() {
  const settings = await getSettings();
  const readiness = settings.apiKey ? "API configured" : "API key missing";

  summary.textContent = [
    settings.enabled ? "Enabled" : "Disabled",
    readiness,
    `Native language: ${settings.nativeLanguage}`
  ].join(" · ");
}
