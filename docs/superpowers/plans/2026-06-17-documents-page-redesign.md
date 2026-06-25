# Documents Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Documents (`Dokumenty`) page to the approved reference look: a flat bottom nav, a lighter title that collapses on scroll, greyer top icons, "Dostosuj widok" moved below the card, and a square "Dodaj dokument" FAB that collapses to "+".

**Architecture:** Pure front-end edits to three shared files. The collapse behaviour copies the proven scoped pattern from `services.js` (`$root = $(window._spaActiveSection || document)`) so it works in both the normal app and the All-in-One (no global-selector cross-contamination).

**Tech Stack:** Static HTML + utility-class CSS (`style.css`) + jQuery (`documentsManager`). No build step; the All-in-One inlines these files at compile time.

## Global Constraints

- Bottom nav stays **4 tabs** (Dokumenty, Usługi, Kod QR, Więcej) — never add "Szukaj".
- Collapse/scroll JS MUST scope to `$(window._spaActiveSection || document)` — never global `$("[data-standalone]")` for title/nav (AIO bug).
- Changes apply to normal app (redeploy) and All-in-One (recompile). Verify the AIO still compiles.
- Verification per task: `node --check` for JS, `grep` for markup/CSS presence, `tests/test_aio_shell_loader.py` for the build; final visual check is the user on a phone.

## File Structure

- `static/new/documents.html` — title structure, top-icon dimming hook, "Dostosuj widok" position, FAB markup, nav `backdrop` removal.
- `static/new/assets/css/style.css` — `.navigation` flat style; `.documents-fab` (+ collapsed) styles; greyer top-icon rule.
- `static/new/assets/js/pages/documents.js` — `documentsManager` scoped collapse handler driving the title + FAB.
- (Consistency) `static/new/{services,qr_code,more}.html` — remove `backdrop[8px]` from their bottom-nav markup.

---

### Task 1: Flat bottom nav (blends with page)

**Files:** Modify `static/new/assets/css/style.css:258-263`; Modify nav markup in `documents.html:625`, `services.html`, `qr_code.html`, `more.html`.

- [ ] **Step 1: Flatten `.navigation` in style.css** — replace the rule so it has no top shadow and an opaque, page-matching background:

```css
.navigation {
    background-color: rgb(var(--background));
    box-shadow: none;
    -webkit-box-shadow: none;
    -moz-box-shadow: none;
}
```
(If `--background` is not defined, use the body/page surface token; confirm by checking `:root`/`[data-mode]` vars in style.css. The bar must end up the same flat colour as the page behind it.)

- [ ] **Step 2: Remove the blur class from each bottom-nav `<div class="navigation ...">`** — delete `backdrop[8px]` from the nav container in `documents.html`, `services.html`, `qr_code.html`, `more.html`. (Bottom nav only — not the top `dashboard-navigation`.)

- [ ] **Step 3: Verify**
Run: `grep -n "box-shadow" static/new/assets/css/style.css | grep navigation` → no shadow on `.navigation`.
Run: `grep -rn 'class="navigation' static/new/*.html` → none contain `backdrop[8px]`.

- [ ] **Step 4: Commit** (left to user — do not auto-commit).

---

### Task 2: Lighter, collapsible "Dokumenty" title

**Files:** Modify `static/new/documents.html:53-72`.

- [ ] **Step 1: Add a small title to the top bar.** Inside the top `dashboard-navigation` (`documents.html:53`), between the logo and the icon group, add a centered small title:

```html
<div class="fillWidth flex justify[center] align[center] dashboard-navigation-small-title">
    <h1 class="font[Inter] text-align[center] font-weight[600] text-size[18] text[nowrap]">Dokumenty</h1>
</div>
```

- [ ] **Step 2: Lighten + wrap the large title.** Change `documents.html:69-71` so the large title is weight 600 and carries the collapse hook:

```html
<div class="height[30px] flex justify[center] align[center] cursor[pointer] dashboard-navigation-large-title">
    <h1 class="font[Inter] font-weight[600] text-size[36]">Dokumenty</h1>
</div>
```

- [ ] **Step 3: Verify**
Run: `grep -n "dashboard-navigation-large-title\|dashboard-navigation-small-title\|font-weight\[600\] text-size\[36\]" static/new/documents.html` → both classes present, large title is weight 600.

---

### Task 3: Greyer top-right icons (chat + notifications)

**Files:** Modify `static/new/assets/css/style.css` (append a scoped rule).

- [ ] **Step 1: Add a dimming rule** so the chat/notif icons read slightly grey:

```css
#chat-button .theme-icon,
#notif-bell .theme-icon {
    opacity: 0.6;
}
```

- [ ] **Step 2: Verify**
Run: `grep -n "chat-button .theme-icon" static/new/assets/css/style.css` → rule present.

---

### Task 4: Reposition "Dostosuj widok" + add FAB markup

**Files:** Modify `static/new/documents.html` (remove top link row `73-78`; add "Dostosuj widok" below the layout root `~203`; add FAB before the bottom nav `~624`).

- [ ] **Step 1: Remove the top "Dostosuj/Dodaj" link row** (`documents.html:73-78`, the `<div class="flex direction[row] justify[end] ...">` containing the two `redirect` links).

- [ ] **Step 2: Add "Dostosuj widok" below the cards** — immediately after the `documents-layout-root` div closes (after `documents.html:203`), inside `[data-wrapper]`:

```html
<div class="flex justify[start] align[center] fillWidth px[s] mt[4]">
    <a class="redirect font-weight[500] text-size[14] color[gray]" data-button="documents">Dostosuj widok</a>
</div>
```

- [ ] **Step 3: Add the FAB** just before the bottom `<div class="navigation ...">` (`documents.html:624`):

```html
<button type="button" class="documents-fab" data-button="add_document_list" aria-label="Dodaj dokument">
    <span class="documents-fab-plus">+</span>
    <span class="documents-fab-label">Dodaj dokument</span>
</button>
```

- [ ] **Step 4: Verify**
Run: `grep -n "documents-fab\|Dostosuj widok" static/new/documents.html` → FAB + relocated link present.
Run: `grep -c 'data-button="add_document_list"' static/new/documents.html` → ≥1 (FAB opens the existing panel; handler unchanged).

---

### Task 5: Square FAB styles (+ collapsed state)

**Files:** Modify `static/new/assets/css/style.css` (append).

- [ ] **Step 1: Add FAB CSS** — fixed bottom-right, rounded square, blue; collapsed = square with just "+":

```css
.documents-fab {
    position: fixed;
    right: 16px;
    bottom: 92px;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 52px;
    padding: 0 18px;
    border: 0;
    border-radius: 16px;
    background: rgb(var(--blue-active, 40 95 244));
    color: #fff;
    font: 600 15px Inter, sans-serif;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(0,0,0,.18);
    transition: width .2s ease, padding .2s ease, border-radius .2s ease;
}
.documents-fab-plus { font-size: 22px; line-height: 1; }
.documents-fab.is-collapsed {
    width: 52px;
    padding: 0;
    justify-content: center;
    border-radius: 16px;
}
.documents-fab.is-collapsed .documents-fab-label {
    display: none;
}
```
(Confirm the blue token name used elsewhere — e.g. `--blue-active` — and reuse it; fallback `40 95 244` keeps it blue if absent.)

- [ ] **Step 2: Verify**
Run: `grep -n "documents-fab.is-collapsed" static/new/assets/css/style.css` → collapsed rule present.

---

### Task 6: Scoped collapse handler in documentsManager (drives title + FAB)

**Files:** Modify `static/new/assets/js/pages/documents.js` — add a `collapsibleHeader()` method called from `init()`.

- [ ] **Step 1: Call the new method from `init()`** (`documents.js:2-5`):

```javascript
    init() {
        this.setupLayout();
        this.listeners();
        this.collapsibleHeader();
    },
```

- [ ] **Step 2: Add `collapsibleHeader()`** (new method on `documentsManager`), copied from the working `services.js` pattern, scoped to the active page, and ALSO toggling the FAB:

```javascript
    collapsibleHeader() {
        const $root = $(window._spaActiveSection || document);
        const $scrollable = $root.find('[data-standalone]');
        const $nav = $root.find('.dashboard-navigation');
        const $largeTitle = $root.find('.dashboard-navigation-large-title');
        const $smallTitle = $root.find('.dashboard-navigation-small-title');
        const $fab = $root.find('.documents-fab');
        if (!$scrollable.length || !$largeTitle.length) return;

        $scrollable.off('scroll.documentsManager');

        const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
        function metrics() {
            const st = $scrollable.scrollTop();
            const navH = $nav.outerHeight() || 0;
            const cRect = $scrollable[0].getBoundingClientRect();
            const tRect = $largeTitle[0].getBoundingClientRect();
            const top = (tRect.top - cRect.top) + st;
            const h = Math.max(1, $largeTitle.outerHeight());
            return { progress: clamp(((st + navH) - top) / h, 0, 1) };
        }
        function apply(p) {
            $largeTitle.css({ opacity: 1 - p, transform: 'translateY(' + (-8 * p) + 'px) scale(' + (1 - 0.02 * p) + ')' });
            $smallTitle.toggleClass('is-visible', p > 0.55);
            $nav.toggleClass('background[backdrop] scrolled', p > 0.55);
            $fab.toggleClass('is-collapsed', p > 0.4);
        }
        apply(metrics().progress);
        $scrollable.on('scroll.documentsManager', function () { apply(metrics().progress); });
    },
```
(No snap-scroll animation here — keep it simple; just map scroll progress to title fade + FAB collapse. Snap can be added later if desired.)

- [ ] **Step 3: Verify JS syntax**
Run: `node --check static/new/assets/js/pages/documents.js`
Expected: no output (valid).

- [ ] **Step 4: Verify scoping (not global)**
Run: `grep -n "window._spaActiveSection || document" static/new/assets/js/pages/documents.js` → present.

---

### Task 7: Build verification

- [ ] **Step 1: Confirm the All-in-One still compiles** (it inlines documents.html + documents.js):
Run: `rm -rf user_data auth_data x; python -m pytest tests/test_aio_shell_loader.py --no-cov 2>&1 | tail -2; rm -rf user_data auth_data x`
Expected: `5 passed`.

- [ ] **Step 2: Syntax-check the changed JS once more**
Run: `node --check static/new/assets/js/pages/documents.js` → valid.

- [ ] **Step 3: Hand off to user for the visual test** — redeploy + recompile AIO, then check on the phone: flat bottom bar, lighter "Dokumenty", title collapses on scroll, greyer icons, "Dostosuj widok" below the card, square "Dodaj dokument" collapsing to "+".

## Self-Review

- **Spec coverage:** all 7 spec changes map to tasks (1→nav, 2/3→title+icons, 4/5→Dostosuj+FAB markup+css, 6→collapse handler, 7→verify). ✓
- **Placeholders:** color tokens (`--background`, `--blue-active`) flagged with fallbacks + a "confirm token" note, not left blank. ✓
- **Type/name consistency:** `.documents-fab` / `is-collapsed` / `dashboard-navigation-large-title` / `dashboard-navigation-small-title` used identically across HTML, CSS, JS. ✓
