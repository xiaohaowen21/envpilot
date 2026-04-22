import { getSettings } from "./storage.js";
import { translateWithOpenAICompatible } from "./openai-compatible.js";

chrome.runtime.onInstalled.addListener(async () => {
  await getSettings();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "settings:get") {
    getSettings()
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message?.type === "translation:run") {
    handleTranslation(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  return false;
});

async function handleTranslation(payload) {
  const settings = await getSettings();

  if (!settings.enabled) {
    throw new Error("Extension is currently disabled.");
  }

  return translateWithOpenAICompatible(settings, payload);
}
