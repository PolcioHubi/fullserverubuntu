(function () {
    "use strict";

    const modeKey = "emulatorMode";
    const dismissedKey = "emulatorChoiceDismissedV2";
    const splitMode = "split";
    const allinoneMode = "allinone";

    // Ostatnio pobrany status dokumentów (/api/user-documents) — wykorzystywany
    // przez okno "Masz już gotowy All-in-One" przy opcji "Zaktualizuj".
    let latestUserDocuments = {};

    function normalizeMode(mode) {
        return mode === splitMode ? splitMode : allinoneMode;
    }

    function readMode() {
        const storedMode = localStorage.getItem(modeKey);
        if (storedMode === allinoneMode || storedMode === splitMode) {
            return storedMode;
        }

        return "";
    }

    function writeMode(mode) {
        localStorage.setItem(modeKey, normalizeMode(mode));
    }

    function checkedTemplate() {
        return document.querySelector('input[name="template_version"]:checked');
    }

    function currentMode() {
        return normalizeMode(document.body.getAttribute("data-emulator-mode") || readMode());
    }

    function selectTemplate(value, scrollToForm) {
        const radio = document.querySelector('input[name="template_version"][value="' + value + '"]');
        if (!radio || radio.checked) {
            updateDocumentRows();
            return;
        }

        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
        updateDocumentRows();

        if (scrollToForm) {
            window.setTimeout(function () {
                const form = document.getElementById("mainForm");
                if (form) {
                    form.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }, 80);
        }
    }

    function applyMode(mode, options) {
        const nextMode = normalizeMode(mode);
        const opts = options || {};

        writeMode(nextMode);
        document.body.setAttribute("data-emulator-mode", nextMode);
        updateModeBanners(nextMode);
        updateProfileModeButtons(nextMode);

        if (opts.selectTemplate !== false) {
            const selected = checkedTemplate();
            if (!selected || selected.value === allinoneMode) {
                selectTemplate("new_mdowod", Boolean(opts.scrollToForm));
            }
        }

        window.dispatchEvent(new CustomEvent("emulator-mode-changed", {
            detail: { mode: nextMode }
        }));
    }

    function updateModeBanners(mode) {
        const isAllin = mode === allinoneMode;
        document.querySelectorAll("[data-emulator-mode-banner]").forEach(function (banner) {
            const title = banner.querySelector("[data-emulator-mode-title]");
            const copy = banner.querySelector("[data-emulator-mode-copy]");

            banner.classList.toggle("is-allin", isAllin);
            banner.classList.toggle("is-split", !isAllin);

            if (title) {
                title.textContent = isAllin ? "Tryb All-in-One aktywny" : "Tryb zwykły aktywny";
            }

            if (copy) {
                copy.textContent = isAllin
                    ? "Dokumenty są składane w jedną płynną aplikację. Pierwsze uruchomienie na nowej przeglądarce może potrwać dłużej."
                    : "Dokumenty działają jako oddzielne pliki. Start jest lżejszy, ale przełączanie może być mniej płynne.";
            }
        });
    }

    function updateProfileModeButtons(mode) {
        document.querySelectorAll("[data-emulator-profile-choice]").forEach(function (button) {
            const isActive = button.getAttribute("data-emulator-profile-choice") === mode;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        document.querySelectorAll("[data-emulator-choice]").forEach(function (button) {
            button.classList.toggle("is-active", button.getAttribute("data-emulator-choice") === mode);
        });
    }

    function updateDocumentRows() {
        const selected = checkedTemplate();
        const value = selected ? selected.value : "";

        document.querySelectorAll("[data-template-choice]").forEach(function (row) {
            row.classList.toggle("is-selected", row.getAttribute("data-template-choice") === value);
        });

        updateFormPanelTitle();
    }

    function getSelectedDocumentLabel() {
        const selected = checkedTemplate();
        if (!selected) {
            return "Dane dokumentu";
        }

        const row = selected.closest("[data-template-choice]");
        const label = row ? row.querySelector(".version-label") : null;
        return label ? label.textContent.trim() : "Dane dokumentu";
    }

    function updateFormPanelTitle() {
        const title = document.querySelector("[data-form-panel-title]");
        if (title) {
            title.textContent = getSelectedDocumentLabel();
        }
    }

    function openFormPanel() {
        const panel = document.getElementById("documentFormPanel");
        if (!panel) {
            return;
        }

        updateFormPanelTitle();
        document.body.classList.add("form-panel-open");
        panel.setAttribute("aria-hidden", "false");
    }

    function closeFormPanel() {
        const panel = document.getElementById("documentFormPanel");
        document.body.classList.remove("form-panel-open");
        if (panel) {
            // Blur focused descendant first — browser blocks aria-hidden on
            // a subtree that retains focus. The back button itself usually
            // has focus when this handler runs.
            if (panel.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            panel.setAttribute("aria-hidden", "true");
        }
    }

    function initFormPanel() {
        const backButton = document.getElementById("formPanelBack");
        if (backButton) {
            backButton.addEventListener("click", closeFormPanel);
        }
    }

    function showChoiceModal() {
        const modal = document.getElementById("emulatorChoiceModal");
        if (!modal || localStorage.getItem(dismissedKey) === "true") {
            return;
        }

        modal.classList.add("is-visible");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("emulator-choice-open");
        window.__emulatorChoiceOpen = true;
    }

    function closeChoiceModal() {
        const modal = document.getElementById("emulatorChoiceModal");
        if (!modal) {
            return;
        }

        modal.classList.remove("is-visible");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("emulator-choice-open");
        window.__emulatorChoiceOpen = false;
        window.dispatchEvent(new CustomEvent("emulator-choice-closed"));
    }

    function initChoiceModal() {
        document.querySelectorAll("[data-emulator-choice]").forEach(function (button) {
            button.addEventListener("click", function () {
                const choice = button.getAttribute("data-emulator-choice") === allinoneMode
                    ? allinoneMode
                    : splitMode;
                applyMode(choice, { scrollToForm: false });
                localStorage.setItem(dismissedKey, "true");
                closeChoiceModal();
            });
        });
    }

    function initProfileControls() {
        document.querySelectorAll("[data-emulator-profile-choice]").forEach(function (button) {
            button.addEventListener("click", function () {
                const choice = button.getAttribute("data-emulator-profile-choice") === allinoneMode
                    ? allinoneMode
                    : splitMode;

                applyMode(choice, { selectTemplate: false });
                localStorage.setItem(dismissedKey, "true");
            });
        });
    }

    function initTemplateRows() {
        document.querySelectorAll('input[name="template_version"]').forEach(function (radio) {
            radio.addEventListener("change", function () {
                updateDocumentRows();
            });
        });

        document.querySelectorAll("[data-template-choice]").forEach(function (row) {
            row.addEventListener("click", function () {
                window.setTimeout(function () {
                    updateDocumentRows();
                    openFormPanel();
                }, 120);
            });
        });

        updateDocumentRows();
    }

    function fetchUserDocuments() {
        return fetch("/api/user-documents", {
            headers: { "Cache-Control": "no-cache" }
        })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                return data && data.success && data.data ? (data.data.documents || {}) : {};
            });
    }

    function generatedDocKeys(documents) {
        return Object.keys(documents || {}).filter(function (key) {
            return key !== "allinone" && documents[key];
        });
    }

    function openAllinoneModal() {
        const modal = document.getElementById("allinoneChoiceModal");
        if (!modal) {
            return;
        }

        const message = document.getElementById("allinone-modal-message");
        if (message) {
            message.textContent = "";
            message.classList.remove("is-error", "is-success", "is-info");
        }
        modal.classList.add("is-visible");
        modal.setAttribute("aria-hidden", "false");

        if (typeof window.refreshAllinoneDocStatus === "function") {
            window.refreshAllinoneDocStatus();
        }
    }

    function closeAllinoneModal() {
        const modal = document.getElementById("allinoneChoiceModal");
        if (!modal) {
            return;
        }

        modal.classList.remove("is-visible");
        modal.setAttribute("aria-hidden", "true");
    }

    function openAllinoneExistingModal() {
        const modal = document.getElementById("allinoneExistingModal");
        if (!modal) {
            return;
        }

        const message = document.getElementById("allinone-existing-message");
        if (message) {
            message.textContent = "";
            message.classList.remove("is-error", "is-success", "is-info");
        }
        modal.classList.add("is-visible");
        modal.setAttribute("aria-hidden", "false");
    }

    function closeAllinoneExistingModal() {
        const modal = document.getElementById("allinoneExistingModal");
        if (!modal) {
            return;
        }

        modal.classList.remove("is-visible");
        modal.setAttribute("aria-hidden", "true");
    }

    function initGeneratedDocumentButton() {
        const button = document.getElementById("openGeneratedDocumentBtn");
        const closeAllinoneButton = document.getElementById("allinoneChoiceClose");
        const closeExistingButton = document.getElementById("allinoneExistingClose");
        const openExistingButton = document.getElementById("allinoneOpenExistingBtn");
        const updateButton = document.getElementById("allinoneUpdateBtn");

        if (closeAllinoneButton) {
            closeAllinoneButton.addEventListener("click", closeAllinoneModal);
        }

        if (closeExistingButton) {
            closeExistingButton.addEventListener("click", closeAllinoneExistingModal);
        }

        // "Otwórz zapisany" — przejdź do gotowego All-in-One (z obecnymi danymi).
        if (openExistingButton) {
            openExistingButton.addEventListener("click", function () {
                window.location.href = "/user_files/allinone.html#login";
            });
        }

        // "Zaktualizuj" — skompiluj ponownie ze wszystkich wygenerowanych dokumentów.
        if (updateButton) {
            updateButton.addEventListener("click", function () {
                if (typeof window.compileAllinone !== "function") {
                    return;
                }
                window.compileAllinone(generatedDocKeys(latestUserDocuments), {
                    button: updateButton,
                    messageId: "allinone-existing-message",
                    emptyMessage: "Brak wygenerowanych dokumentów do aktualizacji. Najpierw wygeneruj dokument w formularzu."
                });
            });
        }

        if (!button) {
            return;
        }

        button.addEventListener("click", async function () {
            // Tryb zwykły: bez wyboru — od razu ekran logowania, a po zalogowaniu
            // użytkownik trafia do głównego menu (/documents) i tam wybiera dokument.
            if (currentMode() !== allinoneMode) {
                window.location.href = "/static/new/login.html";
                return;
            }

            // Tryb All-in-One: sprawdź, czy dokument jest już złożony.
            button.disabled = true;
            try {
                latestUserDocuments = await fetchUserDocuments();
                if (latestUserDocuments.allinone) {
                    openAllinoneExistingModal();
                } else {
                    openAllinoneModal();
                }
            } catch (error) {
                console.error("Nie udało się sprawdzić dokumentu All-in-One:", error);
                openAllinoneModal();
            } finally {
                button.disabled = false;
            }
        });
    }

    function init() {
        const storedMode = readMode();

        initChoiceModal();
        initProfileControls();
        initFormPanel();
        initTemplateRows();
        initGeneratedDocumentButton();

        if (storedMode) {
            applyMode(storedMode, { scrollToForm: false });
        } else {
            applyMode(allinoneMode, { scrollToForm: false, selectTemplate: false });
        }

        showChoiceModal();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
