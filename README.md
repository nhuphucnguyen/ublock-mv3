# uBlock Lite (Manifest V3 Ad Blocker)

A fast, lightweight, and battery-efficient Chrome extension to block ads, tracking beacons, and page annoyances built for **Chrome Extension Manifest V3**, inspired by [gorhill/uBlock](https://github.com/gorhill/ublock) and uBlock Origin Lite.

---

## 🌟 Key Features

1. **Declarative Net Request (DNR) Engine**:
   - Conforms strictly to Chrome Extension Manifest V3 specifications.
   - Zero background process blocking latency: network filtering is executed directly by the Chromium network stack.
   - Built-in static rulesets for:
     - **Advertising Networks & Banners** (`ruleset_default.json`)
     - **Privacy, Analytics & Telemetry** (`ruleset_privacy.json`)
     - **Annoyances, Cookie Banners & Nag Modals** (`ruleset_annoyances.json`)
     - **Social Media Tracking Widgets** (`ruleset_social.json`)
   - Dynamic rules support for custom user rules ("My Filters") and whitelisted domains ("Trusted Sites").

2. **Cosmetic Filtering & Element Hiding**:
   - Injects targeted CSS selectors at `document_start` to hide ad slots, sponsored containers, and banners before they render.
   - Prevents layout flicker and intrusive empty whitespace.
   - Supports generic selectors, domain-specific selectors, and element hiding exceptions (`#@#`).
   - MutationObserver integration hides dynamically injected ads and deferred ad slots.

3. **Interactive Visual Element Picker**:
   - Point-and-click element inspector inspired by uBlock Origin's classic element picker.
   - Real-time hover outline and candidate CSS selector generator (ID, class, attributes, hierarchy).
   - Live "Preview" button to test hiding before saving.
   - Depth navigation ("Parent" / "Child") to expand or narrow element selections.
   - Automatically saves and applies rules to "My Filters".

4. **Scriptlet Defusers & Surrogates**:
   - Library of defusers to neutralize anti-adblock detection scripts and tracking hooks (`noeval`, `abort-on-property-read`, `prevent-bab`, `set-local-storage-item`, `nano-noop`).

5. **Iconic Popup UI**:
   - Large uBlock-style **Power Button** for per-site toggling.
   - Real-time counters:
     - Blocked network requests and hidden elements on the current tab.
     - Total lifetime blocked items counter.
   - Quick tools: Element Picker, Reload Page, Master Global Toggle, and Settings shortcut.

6. **Full-Featured Dashboard & Options**:
   - **General Preferences**: Toggle cosmetic filtering, toolbar badge counter, master switches.
   - **Filter Lists**: Toggle individual built-in DNR static rulesets and subscribe to custom external filter list URLs.
   - **My Filters**: Code editor for custom ABP / uBO rules with live syntax validation, rule counting, and instant compilation to dynamic DNR rules.
   - **Trusted Sites**: Manage whitelisted domains where blocking is paused.
   - **Rule Tester / Inspector**: Live analyzer that tests any ABP/uBO filter line and outputs its parsed AST and Chrome DNR representation.
   - **Backup & Restore**: Export and import configurations and custom filters to/from JSON.

---

## 📂 Project Structure

```
adblock/
├── manifest.json                  # Manifest V3 specification
├── package.json                   # Project metadata and test scripts
├── README.md                      # Documentation
│
├── background/
│   ├── service-worker.js          # MV3 service worker, badge manager, message router
│   ├── rule-manager.js            # DNR static & dynamic rules coordinator
│   └── storage-manager.js         # Configuration & persistent storage manager
│
├── engine/
│   ├── filter-parser.js           # Parser for ABP & uBlock Origin filter syntax
│   ├── dnr-compiler.js            # Compiles parsed rules into Chrome DNR JSON format
│   ├── cosmetic-engine.js         # Domain-indexed element hiding CSS generator
│   ├── scriptlets.js              # Anti-adblock and tracking defuser scriptlets
│   └── default-rules.js           # Curated filter lists (Ads, Privacy, Annoyances, Social)
│
├── content/
│   ├── content-script.js          # Injected into web pages for cosmetic hiding & counters
│   ├── element-picker.js          # Visual point-and-click element picker overlay
│   └── element-picker.css         # Styling for element picker
│
├── popup/
│   ├── popup.html                 # Extension popup interface
│   ├── popup.js                   # Popup logic and tab state communication
│   └── popup.css                  # Modern dark theme popup styles
│
├── options/
│   ├── options.html               # Settings dashboard interface
│   ├── options.js                 # Dashboard controller
│   └── options.css                # Dashboard styling
│
├── rulesets/
│   ├── ruleset_default.json       # Pre-compiled DNR rules for Advertising
│   ├── ruleset_privacy.json       # Pre-compiled DNR rules for Trackers & Analytics
│   ├── ruleset_annoyances.json    # Pre-compiled DNR rules for Cookie & Annoyance notices
│   └── ruleset_social.json        # Pre-compiled DNR rules for Social Widgets
│
├── resources/
│   ├── noop.js                    # Empty replacement script for redirect rules
│   ├── noop.txt                   # Empty text replacement
│   ├── noop.html                  # Blank HTML replacement
│   └── 1x1.png                    # Transparent 1x1 pixel PNG placeholder
│
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
│
├── scripts/
│   ├── compile-rulesets.js        # Script to compile default filter texts to DNR JSON
│   └── generate-icons.js          # Script to generate extension icons
│
└── test/
    ├── parser.test.js             # Unit tests for filter syntax parsing
    ├── compiler.test.js           # Unit tests for Declarative Net Request compiler
    ├── cosmetic.test.js           # Unit tests for element hiding engine
    └── extension-validator.test.js# End-to-end manifest and ruleset integrity validator
```

---

## 🚀 How to Install in Google Chrome

1. Clone or copy this repository to your computer:
   ```bash
   cd /opt/workspace/adblock
   ```
2. Open Google Chrome or any Chromium-based browser (Brave, Edge, Arc, Opera, Vivaldi).
3. Navigate to `chrome://extensions/` in the address bar.
4. Enable **Developer mode** using the toggle in the top-right corner.
5. Click the **Load unpacked** button in the top-left corner.
6. Select the `/opt/workspace/adblock` folder.
7. The **uBlock Lite** shield icon will appear in your Chrome toolbar! Pin it for quick access.

---

## 🧪 Running Automated Tests

Run the test suite using Node's built-in test runner:

```bash
npm test
```

This verifies:
- Parsing of ABP and uBlock filter rule syntax (network, exceptions, options, domains, scriptlets).
- Compilation into Chrome Declarative Net Request rules (`chrome.declarativeNetRequest.Rule`).
- Cosmetic selector hierarchy matching and CSS generation.
- Full `manifest.json` integrity and static DNR ruleset validity.

---

## 🛠 Recompiling Static Rulesets

If you modify the default rule text in `engine/default-rules.js`, recompile the static DNR JSON files with:

```bash
npm run compile-rules
```

---

## 📜 Supported Filter Syntax

- **Network Blocking**:
  - `||doubleclick.net^` (blocks domain and any subdomains)
  - `||google-analytics.com^$script,third-party` (filters by resource type and 3rd-party origin)
  - `@@||example.com^` (exception / allow rule)
  - `||track.com/ad.js$redirect=noopjs` (redirects script to empty placeholder)
- **Cosmetic / Element Hiding**:
  - `##.adsbygoogle` (hides `.adsbygoogle` everywhere)
  - `youtube.com##.sponsor-banner` (hides selector only on YouTube)
  - `example.com#@#.ad-box` (unhides selector on example.com)
- **Scriptlets**:
  - `example.com##+js(noeval)`
  - `example.com##+js(abort-on-property-read, window.trackProp)`
  - `example.com##+js(set-local-storage-item, adblock_dismissed, true)`
