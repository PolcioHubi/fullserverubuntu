const loginManager = {
    deviceId: null,
    initialized: false,

    init() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.setupLayout();
        this.functions();
        this.listeners();
    },

    setupLayout() {
        this.$standalone = $("[data-standalone]");
        this.$wrapper = $("[data-wrapper]");
        this.$standalone.removeClass("overflow[hidden]").addClass("overflow[hidden] overflow[x-hidden]");
    },

    functions() {
        this.getRedirectTarget = function () {
            const fallback = "/documents";
            const params = new URLSearchParams(window.location.search);
            const next = params.get("next");

            if (!next) {
                return fallback;
            }

            try {
                const target = new URL(next, window.location.origin);
                if (target.origin !== window.location.origin) {
                    return fallback;
                }
                // Avoid landing the user straight on a raw document file —
                // /documents gives them a navigable list (matches mObywatel UX).
                if (target.pathname.startsWith("/user_files/")) {
                    return fallback;
                }
                return target.pathname + target.search + target.hash;
            } catch {
                return fallback;
            }
        };

        this.fixViewportScroll = function () {
            this.$wrapper.addClass("overflow[hidden] fixed");
            this.$standalone.addClass("overflow[hidden] fixed");
        };

        this.generateDeviceId = async () => {
            const stored = localStorage.getItem("deviceId");
            if (stored) {
                this.deviceId = stored;
                return;
            }

            // GPU info z WebGL
            let gpuInfo = { vendor: "", renderer: "" };
            try {
                const canvas = document.createElement("canvas");
                const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
                const ext = gl.getExtension("WEBGL_debug_renderer_info");
                gpuInfo = {
                    vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
                    renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
                };
            } catch {}

            // UUID trwały per urządzenie
            const uuid = localStorage.getItem("deviceUuid") || crypto.randomUUID();
            localStorage.setItem("deviceUuid", uuid);

            // Fingerprint → SHA-256
            const fingerprint = JSON.stringify({
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                screen: {
                    width: screen.width,
                    height: screen.height,
                    colorDepth: screen.colorDepth,
                    orientation: (screen.orientation || {}).type || ""
                },
                touch: "ontouchstart" in window,
                gpu: gpuInfo,
                uuid
            });

            const hashBuffer = await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(fingerprint)
            );
            const hashHex = Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");

            localStorage.setItem("deviceId", hashHex);
            this.deviceId = hashHex;
        };
    },

    listeners() {
        const self = this;
        const $passGroup = $('[data-group="password"]');
        const $submitGroup = $('[data-group="submit"]');
        const $input = $passGroup.find("input");
        const $icon = $passGroup.find("i");
        const $dangerMsg = $('[data-message="danger"]');

        // Focus → zablokuj scroll
        $input.on("focus", () => self.fixViewportScroll());

        // Keydown → ukryj błąd
        $input.on("keydown", () => {
            $dangerMsg.addClass("display-none");
            self.fixViewportScroll();
        });

        // Pokaż/ukryj hasło
        $icon.on("click", function () {
            $(this).parent().css("right", "11px");
            const isHidden = $input.attr("type") === "password";
            $input.attr("type", isHidden ? "text" : "password");
            $(this).toggleClass("fa-eye fa-eye-slash");
        });

        // Zaloguj i przejdz do wybranego miejsca.
        $submitGroup.on("click", () => {
            window._navigateTo(self.getRedirectTarget());
        });

        // "Zapomniałem hasła" overlay
        $('[data-button="forgot"]').on("click", function () {
            $("[data-wrapper]").addClass("scale[0.9]");
            $(".forgot").css("transform", "none");
        });

        $('[data-button="forgot_back"]').on("click", function () {
            $(".forgot").css("transform", "translateX(100%)");
            $("[data-wrapper]").removeClass("scale[0.9]");
        });

        // Wygeneruj deviceId od razu
        (async () => {
            await self.generateDeviceId();
        })();
    }
};
