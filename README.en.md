<div align="center">
  <img src="src/assets/app-icon.png" alt="MDText logo" width="96" height="96" />
  <h1>MDText</h1>
  <p><strong>A lightweight Markdown reader</strong></p>
  <p>Beautifully readable · Quick to open · Free and ad-free</p>
  <p>
    <a href="https://github.com/DOTATONG/MDText/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/DOTATONG/MDText?style=flat-square&color=0f8f83" /></a>
    <a href="LICENSE"><img alt="GPL-3.0 license" src="https://img.shields.io/github/license/DOTATONG/MDText?style=flat-square" /></a>
    <img alt="Windows, macOS, and Edge" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Edge-334155?style=flat-square" />
  </p>
  <p>
    <a href="https://github.com/DOTATONG/MDText/releases/latest"><strong>Download</strong></a>
    · <a href="README.md">中文</a>
    · <strong>English</strong>
  </p>
  <p><sub>Unofficial fork of <a href="https://github.com/isunky/MDView">isunky/MDView</a> by Sunky</sub></p>
</div>

---

## Preview

<table>
  <tr>
    <td width="50%" align="center">
      <a href="docs/assets/screenshots/main.png"><img src="docs/assets/screenshots/main.png" alt="MDText welcome screen and recent files" width="100%" /></a>
      <br /><sub>Welcome screen</sub>
    </td>
    <td width="50%" align="center">
      <a href="docs/assets/screenshots/main2.png"><img src="docs/assets/screenshots/main2.png" alt="MDText reading workspace and outline" width="100%" /></a>
      <br /><sub>Reading workspace</sub>
    </td>
  </tr>
</table>

## Overview

MDText is a lightweight, beautifully designed, free and ad-free Markdown reader. Read `.md` files with clear typography; it opens quickly, needs no account, and works just as well with your existing local documents. Editing and exporting a neatly
formatted document are close at hand when you need them.

- **Open in one step** — Double-click a file, use "Open with", or drag a `.md` file into the window; the Windows portable build adds itself to the "Open with" list without administrator rights; multiple windows are supported.
- **Comfortable typography** — Light and dark themes; adjustable font, size, line spacing, and page width; interface zoom (`Ctrl` + `-`/`+`/`0`) is remembered.
- **Long-document navigation** — A collapsible outline with current-heading highlight; reading position and view settings are restored when you reopen a file.
- **Diagrams and formulas** — Mermaid, LaTeX, tables, and syntax highlighting; color swatches; diagrams and images support zoom, pan, and fit-to-window, with ordered browsing and saving in previews.
- **Light editing** — Source mode and synchronized split view; paste, drag in, or batch-insert images; find and replace, undo/redo, and draft recovery.
- **Word import and export** — Convert Word into a Markdown draft; export Word or standalone HTML, or print to PDF.

## Installation

Choose a package from [GitHub Releases](https://github.com/DOTATONG/MDText/releases/latest).

| Platform         | Recommended option                                                       |
|------------------|--------------------------------------------------------------------------|
| Windows          | **MSI**: installer, file associations, and updates                       |
| Windows Portable | **ZIP**: extract and run                                                 |
| macOS            | **[Build from source](docs/BUILD_WITH_AI.md)** (AI-assisted recommended) |
| Microsoft Edge   | **Extension ZIP**: extract and load unpacked                             |

### Environment and file associations

- **Windows** — WebView2 Runtime must be installed separately; MDText does not bundle or download it. The MSI uses an English installer; the app supports Chinese and English.
- **macOS** — The release is a Universal DMG (Intel and Apple Silicon, macOS 10.15+). It is not yet signed or notarized by Apple, so building from source on your own Mac is recommended; local builds may still trigger system security prompts.
- **Edge extension** — Enable Developer mode at `edge://extensions`, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.
- **File associations** — Enabled by default in the MSI and can be deselected during installation; the portable ZIP registers nothing. Use Settings to add MDText to the current user's Markdown "Open with" list, which needs no administrator rights and
  can be undone from the same button.

To disable associations during unattended installation (replace with your actual MSI filename):

```powershell
msiexec /i MDText_x64.msi ASSOCIATE_MARKDOWN_FILES=0 /qn
```

See each release's signing status and the [code signing policy](CODE_SIGNING_POLICY.md).

## Build with AI

Let an AI coding tool with local terminal access handle the build:

1. Download **Source code (zip)** from [Releases](https://github.com/DOTATONG/MDText/releases/latest) and extract it.
2. Open the project folder in the AI tool on the target platform (build macOS on a Mac, Windows on Windows).
3. Send the ready-to-use prompt in [docs/BUILD_WITH_AI.md](docs/BUILD_WITH_AI.md), install any prerequisites it lists, and wait for the package path.

## Reference

### Keyboard shortcuts

| Action           | Windows                   | macOS               |
|------------------|---------------------------|---------------------|
| New              | `Ctrl+N`                  | `Command+N`         |
| Open             | `Ctrl+O`                  | `Command+O`         |
| Save             | `Ctrl+S`                  | `Command+S`         |
| Save As          | `Ctrl+Shift+S`            | `Command+Shift+S`   |
| Find             | `Ctrl+F`                  | `Command+F`         |
| Undo             | `Ctrl+Z`                  | `Command+Z`         |
| Redo             | `Ctrl+Y` / `Ctrl+Shift+Z` | `Command+Shift+Z`   |
| Bold             | `Ctrl+B`                  | `Command+B`         |
| Italic           | `Ctrl+I`                  | `Command+I`         |
| Insert link      | `Ctrl+K`                  | `Command+K`         |
| Indent / Outdent | `Tab` / `Shift+Tab`       | `Tab` / `Shift+Tab` |

### Math formulas

Use `$...$` for inline math and `$$` on separate lines for display math. Click `Σ` for templates and live preview; escape a literal dollar sign as `\$`.

### Word import

Word conversion runs locally; initial setup requires Python and conversion components, with internet access for downloads.

### Development and packaging

Stack: Tauri 2 · React 19 · TypeScript · Vite.

Install Node.js 24, Rust/Cargo, and the [platform build tools](https://v2.tauri.app/start/prerequisites/), then run:

```bash
npm ci
npm run desktop:dev
```

| Target                               | Command                                  |
|--------------------------------------|------------------------------------------|
| Windows MSI                          | `npm run desktop:build -- --bundles msi` |
| Windows MSI + Portable ZIP + SHA-256 | `npm run package:windows`                |
| macOS DMG                            | `npm run desktop:build -- --bundles dmg` |
| Edge ZIP                             | `npm run edge:package`                   |

Verification: `npm test` · `npm run lint` · `npm run build` · `npm run test:e2e`.

Versioning: `npm run version:sync -- <major.minor.patch>`, then `npm run version:check`.

Maintainer docs: [`ROADMAP.md`](ROADMAP.md) · [`Project structure`](docs/PROJECT_STRUCTURE.md) · [`Fork release guide`](docs/FORK_RELEASING.md).

### CI, releases, and signing

Pushes and PRs run quality checks; manual CI runs also build desktop installers. A `v*` tag or the Release workflow publishes a GitHub Release. See [`FORK_RELEASING.md`](docs/FORK_RELEASING.md).

| Integration      | Configuration                                                                               |
|------------------|---------------------------------------------------------------------------------------------|
| Windows SignPath | Secret: `SIGNPATH_API_TOKEN`; Variable: `SIGNPATH_ORGANIZATION_ID`                          |
| Tauri updater    | Secrets: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`                  |
| Edge Add-ons     | Secret: `EDGE_ADDONS_API_KEY`; Variables: `EDGE_ADDONS_CLIENT_ID`, `EDGE_ADDONS_PRODUCT_ID` |

SignPath signing applies to releases after configuration and approval. Create the initial Edge product in Microsoft Partner Center. macOS Developer ID signing and notarization are not yet configured.

## Project

| Item            | Value                                                                              |
|-----------------|------------------------------------------------------------------------------------|
| Version         | 4.0.2                                                                              |
| Author          | [DOTATONG](https://github.com/DOTATONG) (fork maintainer)                          |
| Original author | [Sunky](https://www.sunky.net) / [isunky/MDView](https://github.com/isunky/MDView) |
| License         | [GPL-3.0](LICENSE)                                                                 |

MDText is an unofficial fork of [MDView](https://github.com/isunky/MDView) and retains the original GPL-3.0 license and author attribution.

Third-party dependencies retain their original licenses.
