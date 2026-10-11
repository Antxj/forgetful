# Forgetful

<img src="src/icons/forgetful-logo-256.png" width="96" align="right" alt="Forgetful logo">

**Keep chosen sites and tabs out of your browsing history — automatically, without opening a private window.**

Forgetful is a Firefox extension that removes selected pages from your browsing history as you browse. Mark a site once and it never shows up in your history again; mark a tab and everything you open in it stays off the record.

<p align="center">
  <a href="https://addons.mozilla.org/firefox/addon/forgetful/"><img src="https://img.shields.io/badge/Get%20it%20for%20Firefox-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white" alt="Get it for Firefox" height="40"></a>
</p>

<p align="center">
  <img src="screenshots/popup.png" width="320" alt="Forgetful popup showing the current site excluded from history">
</p>

## Features

- **Per-site rules** — add a site once and every visit to it (including `www.` and any subdomain) is removed from history automatically.
- **Per-tab mode** — mark a tab and all links opened in it are kept out of history (until the tab is closed).
- **Title patterns** — match pages by title, with plain-string or regex patterns.
- **History cleanup tool** — search your existing history by URL, title pattern and date range, then delete the matches in bulk.
- **Firefox Sync** — rules and settings follow your Firefox account across devices and reinstalls (room for thousands of sites).
- **Status badge** — a green ✓ on the toolbar icon means the current page is being kept out of history.
- **Private by design** — no data collection, no external requests. Everything stays on your device or in your Firefox account.
- **Import/export** — full backup as JSON, or just the site list as plain text (one domain per line, easy to edit by hand).

## Screenshots

| Match list | Settings |
| --- | --- |
| <img src="screenshots/settings-sites.png" alt="Match list with excluded sites"> | <img src="screenshots/settings-general.png" alt="General settings"> |

**History cleanup tool** — find and delete pages that are already in your history:

<img src="screenshots/tools.png" alt="History cleanup tool with search results">

## Credits

Forgetful is a fork of [NoHistory](https://github.com/sudoker0/NoHistory) by QuanMCPC, used under the MIT License. This fork adds a redesigned UI, Manifest V3 hardening (session-persisted tab marks, sanitized HTML rendering, bundled fonts) and a simplified status badge.

## License

[MIT](LICENSE)
