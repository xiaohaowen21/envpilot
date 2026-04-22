export const DEFAULT_SETTINGS = {
  enabled: true,
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
  nativeLanguage: "Chinese (Simplified)",
  translateIncoming: true,
  translateOutgoing: true,
  showOriginalText: true,
  autoPlayTranslatedSpeech: false,
  debugMode: false
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  return {
    ...DEFAULT_SETTINGS,
    ...stored
  };
}

export async function saveSettings(nextSettings) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...nextSettings
  };

  await chrome.storage.sync.set(merged);
  return merged;
}
