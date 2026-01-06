# Scrappey Bot Detector

<p align="center">
  <img src="assets/tealy-idle.svg" alt="Tealy" width="100">
</p>

<p align="center">
  <strong>See what anti-bot protections any website is using</strong>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/scrappey-bot-detector/dkjeohgmjalaofokjnkllihjhcaolllh">Chrome Web Store</a> · 
  <a href="https://scrappey.com">Scrappey.com</a> · 
  <a href="https://docs.scrappey.com">Documentation</a> · 
  <a href="https://discord.gg/scrappey">Discord</a>
</p>

---

## What It Does

Scrappey Bot Detector scans websites and shows you:

- **Anti-Bot Systems** — Cloudflare, Akamai, DataDome, PerimeterX, Kasada, Imperva, Shape Security, etc.
- **CAPTCHAs** — reCAPTCHA, hCaptcha, FunCaptcha, GeeTest, Turnstile
- **Fingerprinting** — Canvas, WebGL, Audio, Fonts, WebRTC, Battery API, and more

Each detection shows what triggered it (cookies, scripts, DOM elements, etc.) with confidence scores.

## Installation

### Option 1: Install from Chrome Web Store (Recommended)

1. Visit the [Chrome Web Store page](https://chromewebstore.google.com/detail/scrappey-bot-detector/dkjeohgmjalaofokjnkllihjhcaolllh)
2. Click **Add to Chrome**
3. Click the extension icon to start detecting

### Option 2: Manual Installation

1. Download or clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer Mode** (top-right toggle)
4. Click **Load unpacked** and select the `Scrappey-Detector` folder
5. Click the extension icon to start detecting

## Usage

1. Visit any website
2. Click the Scrappey icon in your toolbar
3. View detected protections with confidence levels
4. Click **Bypass** on any detection for solutions via Scrappey

### Settings

- **Cache Duration** — How long to remember results (default: 12 hours)
- **Show Fingerprinting** — Toggle fingerprint API detection
- **Scrappey API Key** — Optional, shows your account balance

## Detection Methods

| Method | Examples |
|--------|----------|
| Cookies | `cf_clearance`, `datadome`, `_px` |
| Scripts | Protection JS files loaded on page |
| DOM | CAPTCHA containers, challenge iframes |
| Window | Global JS variables like `grecaptcha` |
| JS Hooks | Canvas, WebGL, Audio API calls |

## Adding Custom Detectors

Create a JSON file in `detectors/antibot/`, `detectors/captcha/`, or `detectors/fingerprint/`:

```json
{
  "detector": {
    "id": "my-detector",
    "label": "My Protection",
    "active": true,
    "type": "antibot"
  },
  "meta": {
    "icon": "vendor-default.png",
    "color": "#14B8A6"
  },
  "patterns": {
    "cookies": [
      { "match": "my_cookie", "score": 90 }
    ],
    "urls": [
      { "match": "protection.js", "score": 85 }
    ]
  }
}
```

Add the detector ID to `detectors/index.json` and reload the extension.

## Privacy

- All detection happens locally in your browser
- No data is sent anywhere (except optional Scrappey API balance check)
- Open source — audit the code yourself

## Links

- [Chrome Web Store](https://chromewebstore.google.com/detail/scrappey-bot-detector/dkjeohgmjalaofokjnkllihjhcaolllh) — Install the extension
- [Scrappey.com](https://scrappey.com) — Bypass anti-bot protections
- [Documentation](https://docs.scrappey.com) — API guides and tutorials
- [Discord](https://discord.gg/scrappey) — Community support

---

<p align="center">
  Made by <a href="https://scrappey.com">Scrappey</a>
</p>
