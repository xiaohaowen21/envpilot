const JSON_RESPONSE_RULES = [
  "You are a translation engine for a browser extension.",
  "Detect the source language automatically.",
  "Return strict JSON only.",
  "Use this schema: {\"detectedLanguage\":\"string\",\"translation\":\"string\",\"notes\":\"string\"}.",
  "Keep notes empty unless the text is ambiguous."
].join(" ");

export async function translateWithOpenAICompatible(settings, payload) {
  if (!settings.apiKey) {
    throw new Error("Missing API key. Open the extension settings and add one.");
  }

  const endpoint = new URL("chat/completions", normalizeBaseUrl(settings.apiBaseUrl)).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      response_format: {
        type: "json_object"
      },
      messages: [
        {
          role: "system",
          content: JSON_RESPONSE_RULES
        },
        {
          role: "user",
          content: [
            `Target language: ${payload.targetLanguage}`,
            `Text direction: ${payload.direction}`,
            `Text to translate: ${payload.text}`
          ].join("\n")
        }
      ]
    })
  });

  if (!response.ok) {
    const details = await safeReadError(response);
    throw new Error(`Translation request failed (${response.status}): ${details}`);
  }

  const data = await response.json();
  const rawContent = data?.choices?.[0]?.message?.content;
  const parsed = tryParseJson(rawContent);

  if (!parsed?.translation) {
    throw new Error("Translation provider returned an unexpected response.");
  }

  return {
    detectedLanguage: parsed.detectedLanguage || "unknown",
    translation: parsed.translation,
    notes: parsed.notes || ""
  };
}

function normalizeBaseUrl(baseUrl) {
  const trimmed = (baseUrl || "").trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function tryParseJson(content) {
  if (!content || typeof content !== "string") {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function safeReadError(response) {
  try {
    return await response.text();
  } catch {
    return "Unable to read error response.";
  }
}
