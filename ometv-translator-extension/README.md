# OmeTV Translator Bridge

Open-source browser extension prototype for translating OmeTV chats with a user-provided AI API.

## Product direction

- Users bring their own API key, base URL, and model.
- Incoming messages should be translated into the user's native language.
- Outgoing messages should be translated into the partner's language.
- Speech support is planned as a later phase because the browser audio path is the hard part.

## Current MVP status

This first checkpoint includes:

- Chrome Manifest V3 scaffold
- options page for local settings
- popup for quick readiness checks
- service worker translation abstraction for OpenAI-compatible APIs
- OmeTV content script bootstrap and UI panel

## Load locally

1. Open `chrome://extensions`
2. Enable developer mode
3. Click `Load unpacked`
4. Select the `ometv-translator-extension` folder

## Settings model

The extension stores these values in `chrome.storage.sync`:

- `apiBaseUrl`
- `apiKey`
- `model`
- `nativeLanguage`
- runtime toggles for incoming and outgoing translation

## Next milestones

- harden OmeTV DOM targeting
- wire real translation requests into the message observer
- add outgoing input interception
- evaluate speech-to-text and text-to-speech integration boundaries
