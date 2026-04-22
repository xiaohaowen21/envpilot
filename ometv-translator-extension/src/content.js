const PANEL_ID = "ometv-translator-bridge-panel";

bootstrap();

async function bootstrap() {
  const response = await chrome.runtime.sendMessage({ type: "settings:get" });

  if (!response?.ok || !response.settings?.enabled) {
    return;
  }

  renderPanel(response.settings);
  observeChatSurface(response.settings);
}

function renderPanel(settings) {
  if (document.getElementById(PANEL_ID)) {
    return;
  }

  const panel = document.createElement("section");
  panel.id = PANEL_ID;
  panel.className = "ometv-translator-panel";
  panel.innerHTML = `
    <strong>OmeTV Translator Bridge</strong>
    <p>Watching for chat messages and waiting for the page UI to settle.</p>
    <span class="ometv-translator-badge">${settings.nativeLanguage}</span>
  `;

  document.body.append(panel);
}

function observeChatSurface(settings) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }

        const text = extractCandidateMessage(node);

        if (!text) {
          continue;
        }

        markTranslationCandidate(node, text);

        if (settings.debugMode) {
          console.debug("[OmeTV Translator Bridge] Candidate message detected:", text);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function extractCandidateMessage(node) {
  const text = node.innerText?.trim();

  if (!text) {
    return "";
  }

  if (text.length > 400) {
    return "";
  }

  if (text.split(/\s+/).length < 2) {
    return "";
  }

  return text;
}

function markTranslationCandidate(node, text) {
  if (node.dataset.ometvTranslatorSeen === "true") {
    return;
  }

  node.dataset.ometvTranslatorSeen = "true";

  const translation = document.createElement("div");
  translation.className = "ometv-translator-translation";
  translation.textContent = `Queued for translation: ${text}`;

  node.append(translation);
}
