(function () {
    "use strict";

    const modes = {
        login: {
            path: "/login",
            panelPath: "/login?panel=login",
            title: "Logowanie",
            subtitle: "Zaloguj się do e-mobywatela"
        },
        register: {
            path: "/register",
            panelPath: "/register?panel=register",
            title: "Rejestracja",
            subtitle: "Utwórz konto w e-mobywatelu"
        }
    };

    function getSafeRedirectTarget(rawNext, fallback) {
        if (!rawNext || typeof rawNext !== "string") {
            return fallback;
        }

        if (!rawNext.startsWith("/") || rawNext.startsWith("//")) {
            return fallback;
        }

        // Don't drop the user straight onto a generated document file —
        // route them to the documents list instead, so they land on a
        // navigable screen (matches the real mObywatel UX).
        if (rawNext.startsWith("/user_files/")) {
            return "/documents";
        }

        return rawNext;
    }

    function getShell() {
        return document.querySelector(".auth-shell");
    }

    function getMode() {
        const shell = getShell();
        const mode = shell ? shell.getAttribute("data-auth-mode") : "";
        return modes[mode] ? mode : "login";
    }

    function setFieldNames(form, active) {
        form.querySelectorAll("[data-auth-name]").forEach(function (field) {
            const fieldName = field.getAttribute("data-auth-name");

            if (active && fieldName) {
                field.setAttribute("name", fieldName);
                field.disabled = false;
            } else {
                field.removeAttribute("name");
                field.disabled = true;
            }
        });
    }

    function updateUrl(mode, panelOpen) {
        if (!window.history || !window.history.replaceState) {
            return;
        }

        const nextUrl = panelOpen ? modes[mode].panelPath : modes[mode].path;
        window.history.replaceState({ authMode: mode, panelOpen: panelOpen }, "", nextUrl);
    }

    function setMode(mode, panelOpen, options) {
        const nextMode = modes[mode] ? mode : "login";
        const settings = options || {};
        const shell = getShell();
        const panel = document.querySelector(".auth-panel");
        const subtitle = document.querySelector("[data-auth-subtitle]");

        if (!shell || !panel) {
            return;
        }

        shell.setAttribute("data-auth-mode", nextMode);
        shell.setAttribute("data-panel-open", panelOpen ? "true" : "false");
        document.body.setAttribute("data-auth-page", nextMode);
        document.title = modes[nextMode].title;

        if (subtitle) {
            subtitle.textContent = modes[nextMode].subtitle;
        }

        document.querySelectorAll("[data-auth-target]").forEach(function (button) {
            button.classList.toggle("is-active", button.getAttribute("data-auth-target") === nextMode);
        });

        document.querySelectorAll("[data-auth-form]").forEach(function (form) {
            const active = form.getAttribute("data-auth-form") === nextMode;
            form.hidden = !active;
            setFieldNames(form, active);
        });

        panel.hidden = !panelOpen;

        if (settings.updateUrl) {
            updateUrl(nextMode, panelOpen);
        }

        if (panelOpen && settings.focus) {
            window.setTimeout(function () {
                const activeForm = document.querySelector('[data-auth-form="' + nextMode + '"]');
                const firstField = activeForm ? activeForm.querySelector("input:not([type='hidden']), textarea") : null;

                if (firstField) {
                    firstField.focus({ preventScroll: true });
                }
            }, 60);
        }

        if (!panelOpen) {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }

    function showAlert(message, type) {
        const successAlert = document.getElementById("successAlert");
        const errorAlert = document.getElementById("errorAlert");
        const alertElement = type === "success" ? successAlert : errorAlert;
        const otherAlert = type === "success" ? errorAlert : successAlert;

        if (otherAlert) {
            otherAlert.style.display = "none";
        }

        if (alertElement) {
            alertElement.textContent = message || "Wystąpił błąd";
            alertElement.style.display = "block";
        }

        if (type !== "success" && alertElement) {
            window.setTimeout(function () {
                alertElement.style.display = "none";
            }, 5000);
        }
    }

    function setLoading(show, loadingId, buttonId, loadingText, idleText) {
        const loading = document.getElementById(loadingId);
        const button = document.getElementById(buttonId);

        if (loading) {
            loading.style.display = show ? "block" : "none";
        }

        if (button) {
            button.disabled = show;
            button.textContent = show ? loadingText : idleText;
        }
    }

    function fieldValue(form, fieldName) {
        const field = form.querySelector('[data-auth-name="' + fieldName + '"]');
        return field ? field.value : "";
    }

    function checkboxChecked(form, fieldName) {
        const field = form.querySelector('[data-auth-name="' + fieldName + '"]');
        return field ? field.checked : false;
    }

    function csrfValue(form) {
        const field = form.querySelector('[data-auth-name="csrf_token"]');
        return field ? field.value : "";
    }

    function setupChoiceButtons() {
        document.querySelectorAll("[data-auth-target]").forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                setMode(button.getAttribute("data-auth-target"), true, {
                    focus: true,
                    updateUrl: true
                });
            });
        });
    }

    function setupBackButtons() {
        document.querySelectorAll("[data-auth-back]").forEach(function (button) {
            button.addEventListener("click", function () {
                setMode(getMode(), false, { updateUrl: true });
            });
        });
    }

    function setupPasswordToggles() {
        document.querySelectorAll("[data-toggle-password]").forEach(function (button) {
            button.addEventListener("click", function () {
                const input = document.getElementById(button.getAttribute("data-toggle-password"));
                if (!input) {
                    return;
                }

                const willShow = input.type === "password";
                input.type = willShow ? "text" : "password";
                button.classList.toggle("is-visible", willShow);
                button.setAttribute("aria-label", willShow ? "Ukryj hasło" : "Pokaż hasło");
            });
        });
    }

    function setupInitialMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const requestedPanel = urlParams.get("panel");
        const currentPage = document.body.getAttribute("data-auth-page") || "login";
        const initialPanel = document.body.getAttribute("data-initial-panel") === "true";
        const mode = modes[requestedPanel] ? requestedPanel : currentPage;
        const panelOpen = modes[requestedPanel] ? true : initialPanel;

        setMode(mode, panelOpen, { updateUrl: false });
    }

    function setupLogin() {
        const loginForm = document.getElementById("loginForm");
        if (!loginForm) {
            return;
        }

        loginForm.classList.add("no-transition");

        const urlParams = new URLSearchParams(window.location.search);
        const message = urlParams.get("message");
        const isPwaLaunch = urlParams.get("pwa") === "1";
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches
            || window.navigator.standalone === true;
        const redirectTarget = getSafeRedirectTarget(
            urlParams.get("next"),
            (isPwaLaunch || isStandalone) ? "/documents" : "/"
        );

        if (isStandalone) {
            try {
                sessionStorage.setItem("pwa-login-launch-checked", "1");
            } catch (error) {
                console.warn("Nie udało się zapisać stanu startu PWA:", error);
            }
        }

        loginForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const username = fieldValue(loginForm, "username").trim();
            const password = fieldValue(loginForm, "password");

            if (!username) {
                showAlert("Nazwa użytkownika jest wymagana", "error");
                return;
            }

            if (!password) {
                showAlert("Hasło jest wymagane", "error");
                return;
            }

            setLoading(true, "loginLoading", "loginBtn", "Logowanie...", "Zaloguj się");

            try {
                const response = await fetch("/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrfValue(loginForm)
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password,
                        remember: checkboxChecked(loginForm, "remember")
                    })
                });

                const data = await response.json();

                if (data.success) {
                    const destination = data.redirect || (data.admin ? "/admin/" : redirectTarget);
                    showAlert("Logowanie pomyślne! Przekierowywanie...", "success");

                    window.setTimeout(function () {
                        window.location.href = destination;
                    }, 350);
                } else {
                    showAlert(data.error, "error");
                }
            } catch (error) {
                console.error("Error:", error);
                showAlert("Wystąpił błąd podczas logowania. Spróbuj ponownie.", "error");
            } finally {
                setLoading(false, "loginLoading", "loginBtn", "Logowanie...", "Zaloguj się");
            }
        });

        if (message === "registered") {
            setMode("login", true, { updateUrl: false });
            showAlert("Rejestracja przebiegła pomyślnie! Możesz się teraz zalogować.", "success");
        }
    }

    function setupRegisterValidation(usernameInput, passwordInput) {
        if (usernameInput) {
            usernameInput.addEventListener("input", function () {
                const username = usernameInput.value.trim();
                usernameInput.style.borderColor = username.length > 0 && username.length < 3 ? "#e74c3c" : "";
            });
        }

        if (passwordInput) {
            passwordInput.addEventListener("input", function () {
                const password = passwordInput.value;
                passwordInput.style.borderColor = password.length > 0 && password.length < 6 ? "#e74c3c" : "";
            });
        }
    }

    function setupRegisterOverlay() {
        const fullScreenOverlay = document.getElementById("fullScreenOverlay");
        const overlayTokenDisplay = document.getElementById("overlayTokenDisplay");
        const overlayActualRecoveryToken = document.getElementById("overlayActualRecoveryToken");
        const overlayCopyTokenBtn = document.getElementById("overlayCopyTokenBtn");
        const overlayCountdownMessage = document.getElementById("overlayCountdownMessage");
        const overlayProceedBtn = document.getElementById("overlayProceedBtn");

        function showOverlayWithToken(token) {
            if (fullScreenOverlay) {
                fullScreenOverlay.classList.add("visible");
            }

            if (overlayActualRecoveryToken) {
                overlayActualRecoveryToken.textContent = token;
            }

            if (overlayTokenDisplay) {
                overlayTokenDisplay.setAttribute("data-token", token);
            }

            let countdown = 7;
            if (overlayCountdownMessage) {
                overlayCountdownMessage.textContent = "Przekierowanie do logowania za " + countdown + " sekund...";
            }

            const interval = window.setInterval(function () {
                countdown -= 1;
                if (overlayCountdownMessage) {
                    overlayCountdownMessage.textContent = "Przekierowanie do logowania za " + countdown + " sekund...";
                }

                if (countdown <= 0) {
                    window.clearInterval(interval);
                    window.location.href = "/login?panel=login";
                }
            }, 1000);
        }

        if (overlayCopyTokenBtn) {
            overlayCopyTokenBtn.addEventListener("click", async function () {
                const token = overlayTokenDisplay ? overlayTokenDisplay.getAttribute("data-token") : "";
                try {
                    await navigator.clipboard.writeText(token);
                    overlayCopyTokenBtn.textContent = "Skopiowano";
                    window.setTimeout(function () {
                        overlayCopyTokenBtn.textContent = "Kopiuj";
                    }, 1600);
                } catch (error) {
                    console.error("Failed to copy:", error);
                    showAlert("Nie udało się skopiować tokena. Skopiuj go ręcznie.", "error");
                }
            });
        }

        if (overlayProceedBtn) {
            overlayProceedBtn.addEventListener("click", function () {
                window.location.href = "/login?panel=login";
            });
        }

        return showOverlayWithToken;
    }

    function setupRegister() {
        const registerForm = document.getElementById("registerForm");
        if (!registerForm) {
            return;
        }

        registerForm.classList.add("no-transition");

        const usernameInput = registerForm.querySelector('[data-auth-name="username"]');
        const passwordInput = registerForm.querySelector('[data-auth-name="password"]');
        const showOverlayWithToken = setupRegisterOverlay();

        setupRegisterValidation(usernameInput, passwordInput);

        registerForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            setLoading(true, "registerLoading", "registerBtn", "Rejestrowanie...", "Zarejestruj się");

            const username = fieldValue(registerForm, "username").trim();
            const password = fieldValue(registerForm, "password");
            const confirmPassword = fieldValue(registerForm, "confirm_password");
            const accessKey = fieldValue(registerForm, "accessKey").trim();
            const referralCode = fieldValue(registerForm, "referralCode").trim();

            if (password !== confirmPassword) {
                showAlert("Hasła nie są zgodne", "error");
                setLoading(false, "registerLoading", "registerBtn", "Rejestrowanie...", "Zarejestruj się");
                return;
            }

            try {
                const response = await fetch("/register", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrfValue(registerForm)
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password,
                        access_key: accessKey,
                        referral_code: referralCode
                    })
                });
                const data = await response.json();

                if (data.success) {
                    if (data.recovery_token) {
                        showOverlayWithToken(data.recovery_token);
                    } else {
                        showAlert("Rejestracja przebiegła pomyślnie! Możesz się teraz zalogować.", "success");
                        window.setTimeout(function () {
                            setMode("login", true, { updateUrl: true });
                        }, 1200);
                    }
                    registerForm.reset();
                } else {
                    showAlert(data.error, "error");
                }
            } catch (error) {
                console.error("Error:", error);
                showAlert("Wystąpił błąd podczas rejestracji. Spróbuj ponownie.", "error");
            } finally {
                setLoading(false, "registerLoading", "registerBtn", "Rejestrowanie...", "Zarejestruj się");
            }
        });
    }

    function init() {
        setupChoiceButtons();
        setupBackButtons();
        setupPasswordToggles();
        setupInitialMode();
        setupLogin();
        setupRegister();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
