# Repository maintenance — 2026-11-25

## Scope and baseline

- User request: repair the site, delete residual/duplicate content, then push.
- Baseline: `master`, `9da7802`; clean working tree; local `origin/master`
  matches the cloned baseline. A fresh remote check is required before pushing.
- Original tracked files: 128, 300.66 MiB.
- Reproduced: `loadScanSelection()` null-element exception; missing comparison
  images and icon fonts; homepage uses a 980px layout on a 390px mobile screen.

## Changes

- Keep `/osi-bench/`; `/openbench/` and `/openbench-or/` redirect there and preserve
  query strings and fragments when JavaScript is enabled. Legacy files remain in
  Git history; no history rewrite.
- Keep the paper's authors, prose, table values and citation unchanged. Remove
  template-only JavaScript, third-party component/icon dependencies, unused files,
  duplicate functions, empty navigation and malformed wrapper markup.
- Fix homepage GitHub URL, UTF-8/viewport metadata, duplicate ID, image alt text,
  stray comment terminator and mobile layout. Remove unused homepage template CSS.
- Extract paper styles, add image dimensions/lazy loading, support reduced motion,
  and keep the answer button as a small dependency-free script.
- Recompress 20 PNG files; decompressed PNG scanlines were checked
  byte-for-byte and non-IDAT chunks were retained. Image content is unchanged.
- Add README, `.gitignore` and `.nojekyll`; remove the unused Jekyll theme config.

## Validation

- `python3 output/playwright/audit-site.py`: passed. Four HTML documents have
  balanced tags, unique IDs and valid local references; CSS has no missing assets.
  The paper headings, prose, authors, table and citation match the baseline;
  homepage paragraphs match. All 21 retained PNGs have identical decompressed
  scanlines and metadata to the baseline (20 were recompressed).
- `node --check osi-bench/static/js/index.js`: passed.
- `git diff --check`: passed.
- Browser command (existing local runtime, no dependency installation):
  `LD_LIBRARY_PATH=/tmp/wtm-browser-libs/unpacked/usr/lib/x86_64-linux-gnu npm_config_offline=true /Disk1/WuMingrui/wtm-projectpage/.agents/skills/playwright/scripts/playwright_cli.sh --session mingrui-maintenance-20261125 run-code --filename output/playwright/verify-site.js`.
- Playwright: both pages at 320, 390, 700, 701, 768 and 1440px, plus a real
  390px mobile viewport; no document overflow. Mouse, keyboard and touch answer
  reveal, homepage project link, normal/reduced-motion carousel, and both legacy
  redirects with and without JavaScript passed. JavaScript redirects retain query
  strings and fragments. Zero page errors, HTTP errors and failed requests.
- Screenshots were visually checked. Local verification artifacts and scripts:
  `output/playwright/` (ignored by Git).

## Size and publication

- Working site files: 300.66 MiB -> 50.67 MiB (about 83% smaller). This measures
  current files, not Git history; old commits and their assets are retained.
- Fresh fetch through the session-provided proxy confirmed `HEAD` and
  `origin/master` match at the baseline before committing.
- GitHub API confirmed Pages uses `master` at `/` (`build_type: legacy`).
- Publication target: normal `git push origin master`, with a per-command
  `http.proxy` override for the active session. The commit is self-contained;
  the Git history and remote branch record the published revision.
- Remaining source issues: none found in the checks above.
