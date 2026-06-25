# Documents page redesign — design

**Date:** 2026-06-17
**Status:** Approved (design)

## Context

Restyle the **Documents** (`Dokumenty`) page to match the user's older (lost-source)
reference screenshot — but **without** the "Szukaj" bottom-nav tab. The user edits
this checkout; changes reach their phone via redeploy of the normal app and
**recompiling the All-in-One** (the AIO bundles `documents.html` + `documents.js`).

**Files affected:**
- `static/new/documents.html` — page markup (title, top icons, "Dostosuj/Dodaj", bottom nav)
- `static/new/assets/css/style.css` — shared `.navigation` (bottom bar), title weight, new FAB styles
- `static/new/assets/js/pages/documents.js` — `documentsManager` (collapsible title + FAB scroll behavior)

Both the normal app and the All-in-One use these files, so all changes apply to both.

## The 7 changes

1. **Bottom nav bar blends with the page.** `.navigation` (style.css:258) currently has
   `background-color: rgba(var(--navigation-background), 0.85)` + a faint top `box-shadow`,
   and `documents.html` adds a `backdrop[8px]` blur. Change: nav background = the page
   background colour at full opacity, **remove** the top shadow and the `backdrop[8px]`
   blur so the bar is flat and does not "stick out". Applied to the shared `.navigation`
   (so it's consistent on every page) + remove `backdrop[8px]` from the nav markup on the
   bundled pages (documents, services, qr_code, more).

2. **Keep 4 tabs, no "Szukaj".** The nav already has exactly Dokumenty / Usługi / Kod QR /
   Więcej. No change beyond ensuring it stays 4 (do not add search).

3. **"Dokumenty" title lighter.** `font-weight[700]` → `font-weight[600]` (documents.html:70).

4. **Collapsible title on scroll** (like Usługi/Więcej). Wrap "Dokumenty" in
   `.dashboard-navigation-large-title`; add a centered `.dashboard-navigation-small-title`
   "Dokumenty" in the top `.dashboard-navigation` bar. Add a collapse handler to
   `documentsManager` **scoped to the active page** (`$root = $(window._spaActiveSection || document)`),
   copied from the working `services.js` pattern (avoids the AIO global-selector bug).

5. **Top-right icons (💬 chat, 🔔 notifications) slightly greyer.** Apply a subtle
   dim (~60% opacity) to the `theme-icon` images in `#chat-button` / `#notif-bell`.

6. **"Dostosuj widok" repositioned.** Remove it from the top link row; place it as a small
   grey text link **below the document card area** (left-aligned), matching the reference.

7. **"Dodaj dokument" → square collapsing FAB.** Floating button, bottom-right. Expanded
   (at top): rounded **square** showing `+ Dodaj dokument`. On scroll down: collapses to a
   square showing just `+`. Re-expands at the top. Opens the existing add-document panel
   (`data-button="add_document_list"`). Driven by the same scroll handler as the title.

## Implementation notes

- **Collapse handler:** reuse the exact scoped structure from `services.js`
  (`$root.find(...)`, `getScrollMetrics`, `applyProgress`, snap). Drives both the title
  collapse and the FAB collapse (single scroll listener on the page's `[data-standalone]`).
- **FAB collapse:** toggle a CSS class on the FAB (e.g. `is-collapsed`) based on scroll
  progress > threshold; CSS animates width/label out, leaving the square `+`.
- **No new bottom-nav tab, no search feature** (explicitly out of scope).

## Verification

- `node --check` on the modified `documents.js`.
- Full AIO compile test still passes (`tests/test_aio_shell_loader.py`) — confirms the
  bundled page still builds.
- Manual/visual: user tests on phone after redeploy + AIO recompile (desktop can't
  reproduce mobile scroll/compositor behaviour).

## Out of scope

- The "Szukaj" search feature.
- The white-screen-on-save bug (tracked separately).
- Any change to other pages beyond the shared `.navigation` blend + `backdrop[8px]` removal.
