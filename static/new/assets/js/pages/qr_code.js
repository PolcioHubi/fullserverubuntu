const LOCAL_ZXING_PATH = "/assets/js/vendor/zxing.min.js";
const DEFAULT_SCAN_WARNING = "Upewnij się, że kod QR pochodzi z wiarygodnego źródła";

const qrCodeManager = {
    interval: null,

    init() {
        this.functions();
        this.listeners();
        this.setupLayout();
    },

    setupLayout() {
        this.$standalone = $("[data-standalone]");
        this.$wrapper = $("[data-wrapper]");
        this.$standalone
            .removeClass("overflow[hidden]")
            .addClass("overflow[x-hidden] overflow[hidden] fixed");
        if ($(window).height() < 680) {
            this.$standalone
                .removeClass("overflow[hidden]")
                .addClass("overflow[x-hidden] overflow[hidden] fixed");
        }
    },

    functions() {
        this.jumpTop = function () {
            $("html, body").stop(true, true).scrollTop(0);
            $("*").each(function () {
                const style = getComputedStyle(this);
                const scrollsY = /(auto|scroll|overlay)/.test(style.overflowY)
                    && (this.scrollHeight - this.clientHeight > 1);
                const scrollsX = /(auto|scroll|overlay)/.test(style.overflowX)
                    && (this.scrollWidth - this.clientWidth > 1);
                if (scrollsY || scrollsX) {
                    this.scrollTop = 0;
                    this.scrollLeft = 0;
                }
            });
        };

        this.calculateViewport = function (flag = false) {
            if (flag && $(window).height() < 680) {
                this.$standalone.removeClass("overflow[hidden]").addClass("overflow[x-hidden]");
                return true;
            }
            return false;
        };

        this.generateRandomCode = function () {
            return Math.floor(100000 + Math.random() * 900000).toString();
        };

        this.calculateTime = function (ms) {
            return {
                minutes: Math.floor(ms / 60000),
                seconds: Math.floor((ms % 60000) / 1000)
            };
        };

        this.updateExpiry = function (progressBar, startTime, label) {
            const DURATION = 180000; // 3 minuty

            const tick = () => {
                const remaining = DURATION - (Date.now() - startTime);

                if (remaining <= 0) {
                    progressBar.css("width", "0%");
                    label.html(
                        '<p class="font[Inter] text-align[center] font-weight[400] text-size[16]">'
                        + label.data("prefix")
                        + '</p><p class="font[Inter] text-align[center] font-weight[600] text-size[14]">0 '
                        + label.data("second") + "</p>"
                    );
                    qrCodeManager.showNewQRCode();
                    return;
                }

                const percent = (remaining / DURATION) * 100;
                progressBar.css({ width: percent + "%" }, 500);

                const { minutes, seconds } = this.calculateTime(remaining);
                if (minutes > 0) {
                    label.html(
                        '<p class="font[Inter] text-align[center] font-weight[400] text-size[16]">'
                        + label.data("prefix")
                        + '</p><p class="font[Inter] text-align[center] font-weight[600] text-size[14]">'
                        + minutes + " " + label.data("minute") + "  "
                        + seconds + " " + label.data("second") + "</p>"
                    );
                } else {
                    label.html(
                        '<p class="font[Inter] text-align[center] font-weight[400] text-size[16]">'
                        + label.data("prefix")
                        + '</p><p class="font[Inter] text-align[center] font-weight[600] text-size[14]">'
                        + seconds + " " + label.data("second") + "</p>"
                    );
                }
            };

            tick();
            this.interval = setInterval(tick, 1000);
        };

        this.isValidCode = function (code) {
            return typeof code === "string";
        };

        this.isAppleMobile = function () {
            if (typeof this._isAppleMobile === "boolean") return this._isAppleMobile;
            this._isAppleMobile =
                (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
                /iPad|iPhone|iPod/.test(navigator.userAgent);
            return this._isAppleMobile;
        };

        this.updateScanWarning = function (message, tone = "warning") {
            const $wrap = $('[data-div="scan_warning"]');
            const $card = $wrap.find(".card");
            const $text = $('[data-p="scan_warning_text"]');
            if (!$wrap.length || !$card.length || !$text.length) return;

            $wrap.removeClass("display-none");
            $card.removeClass("warning info danger").addClass(tone);
            $text.text(message);
        };

        this.resetScanWarning = function () {
            this.updateScanWarning(DEFAULT_SCAN_WARNING, "warning");
        };

        this.describeCameraError = function (err) {
            const name = String(err?.name || "");
            if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
                return "Brak dostępu do kamery. Sprawdź zgodę na aparat albo wpisz kod ręcznie.";
            }
            if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
                return "Nie udało się uruchomić tylnej kamery. Spróbuj ponownie albo wpisz kod ręcznie.";
            }
            return "Nie udało się przygotować aparatu. Spróbuj ponownie albo wpisz kod ręcznie.";
        };

        this.waitForScannerWarmup = async function (video) {
            const warmupMs = this.isAppleMobile() ? 850 : 280;

            await new Promise((resolve) => {
                if (video.readyState >= 2) {
                    setTimeout(resolve, warmupMs);
                    return;
                }

                let settled = false;
                const finish = () => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    setTimeout(resolve, warmupMs);
                };
                const cleanup = () => {
                    video.removeEventListener("loadeddata", finish);
                    video.removeEventListener("canplay", finish);
                };

                video.addEventListener("loadeddata", finish, { once: true });
                video.addEventListener("canplay", finish, { once: true });
                setTimeout(finish, warmupMs + 900);
            });
        };

        this.getLocalZXing = function () {
            if (window.ZXing && window.ZXing.BrowserMultiFormatReader) {
                return Promise.resolve(window.ZXing);
            }

            if (!this._zxingLoader) {
                this._zxingLoader = new Promise((resolve, reject) => {
                    const existing = document.querySelector(`script[src="${LOCAL_ZXING_PATH}"]`);
                    if (existing) {
                        existing.addEventListener("load", () => resolve(window.ZXing), { once: true });
                        existing.addEventListener("error", reject, { once: true });
                        return;
                    }

                    const script = document.createElement("script");
                    script.src = LOCAL_ZXING_PATH;
                    script.async = true;
                    script.onload = () => resolve(window.ZXing);
                    script.onerror = (err) => reject(err);
                    document.head.appendChild(script);
                });
            }

            return this._zxingLoader;
        };

        this.startScanner = async function () {
            if (this._scanning) return;
            this._scanning = true;

            const video = document.getElementById("camera");
            if (!video) {
                console.log("#camera video element not found");
                this._scanning = false;
                return;
            }

            const preferLocalDecoder = this.isAppleMobile();
            let hasBarcodeAPI = false;
            if (!preferLocalDecoder && "BarcodeDetector" in window) {
                try {
                    const formats = await BarcodeDetector.getSupportedFormats?.();
                    hasBarcodeAPI = Array.isArray(formats) ? formats.includes("qr_code") : true;
                } catch {
                    hasBarcodeAPI = true;
                }
            }

            const onCodeFound = (text) => {
                if (!this.isValidCode(text)) return false;
                $('[class-wrapper="scan_qr"]').addClass("scale[0.9]");
                $("[data-standalone]")
                    .addClass("overflow[x-hidden] overflow[y-auto]")
                    .removeClass("overflow[hidden]");
                $(".type_code").addClass("display-none");
                $(".share_data").removeClass("display-none");
                setTimeout(() => {
                    $(".share_data").removeClass("hide").css("transform", "");
                }, 50);
                return true;
            };

            if (hasBarcodeAPI) {
                try {
                    this._detector = new BarcodeDetector({ formats: ["qr_code"] });
                } catch {
                    try { this._detector = new BarcodeDetector(); } catch {}
                }
            }

            if (this._detector) {
                const scanFrame = async () => {
                    if (!this._scanning) return;
                    if (video.readyState >= 2) {
                        try {
                            const results = await this._detector.detect(video);
                            if (results && results.length) {
                                const text = String(results[0].rawValue || "");
                                if (onCodeFound(text)) {
                                    this.stopCamera();
                                    return;
                                }
                            }
                        } catch {}
                    }
                    this._scanRaf = requestAnimationFrame(scanFrame);
                };
                this._scanRaf = requestAnimationFrame(scanFrame);
                return;
            }

            try {
                const ZXing = await this.getLocalZXing();
                if (!ZXing || !ZXing.BrowserMultiFormatReader) {
                    console.log("ZXing UMD not available");
                    this._scanning = false;
                    return;
                }

                const hints = new Map();
                if (ZXing.DecodeHintType && ZXing.BarcodeFormat) {
                    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
                }
                this._zxingReader = new ZXing.BrowserMultiFormatReader(hints);
                if (typeof this._zxingReader.decode !== "function") {
                    console.log("ZXing decode(video) is not available");
                    this._scanning = false;
                    this.updateScanWarning("Nie udało się uruchomić lokalnego skanera. Wpisz kod ręcznie.", "danger");
                    return;
                }

                this._zxingDecoding = false;
                const scanFrame = async () => {
                    if (!this._scanning) return;

                    this._scanRaf = requestAnimationFrame(scanFrame);

                    if (video.readyState < 2 || this._zxingDecoding) return;

                    this._zxingDecoding = true;
                    try {
                        const result = await this._zxingReader.decode(video);
                        const text = String(result?.getText?.() || result?.text || "");
                        if (text && onCodeFound(text)) {
                            this.stopCamera();
                        }
                    } catch {
                        // Keep scanning alive on all decode errors, including iOS canvas/security hiccups.
                    } finally {
                        this._zxingDecoding = false;
                    }
                };

                this._zxingActive = true;
                this._scanRaf = requestAnimationFrame(scanFrame);
            } catch (err) {
                console.log("ZXing fallback failed", err);
                this._scanning = false;
                this.updateScanWarning("Nie udało się uruchomić lokalnego skanera. Wpisz kod ręcznie.", "danger");
            }
        };

        this.stopScanner = function () {
            this._scanning = false;
            if (this._scanRaf) {
                cancelAnimationFrame(this._scanRaf);
                this._scanRaf = null;
            }
            this._zxingDecoding = false;
            this._detector = null;
            if (this._zxingReader) {
                try { this._zxingReader.reset(); } catch {}
                this._zxingActive = false;
                this._zxingReader = null;
            }
        };

        this.startCamera = async function () {
            if (this._cameraStarting) return;
            this._cameraStarting = true;

            const getOrCreateVideo = () => {
                let el = document.getElementById("camera");
                if (!el) {
                    el = document.createElement("video");
                    el.id = "camera";
                    document.body.appendChild(el);
                }
                el.setAttribute("playsinline", "");
                el.setAttribute("muted", "");
                el.muted = true;
                el.autoplay = true;
                el.playsInline = true;
                el.disablePictureInPicture = true;
                el.setAttribute("autoplay", "");
                return el;
            };

            try {
                if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
                    this.updateScanWarning("Ta przeglądarka nie obsługuje aparatu do skanowania QR.", "danger");
                    return;
                }

                this.stopCamera();
                this.resetScanWarning();
                this.updateScanWarning("Przygotowuję aparat do skanowania...", "info");

                const video = getOrCreateVideo();
                const constraints = {
                    audio: false,
                    video: {
                        facingMode: { ideal: "environment" },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                };

                const attachStream = async (stream) => {
                    video.srcObject = stream;
                    this.videoStream = stream;
                    await new Promise(resolve => {
                        if (video.readyState >= 2) return resolve();
                        video.onloadedmetadata = () => resolve();
                    });
                    try { await video.play(); } catch {}
                    await this.waitForScannerWarmup(video);
                    this.resetScanWarning();
                    this.startScanner();
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                await attachStream(stream);
            } catch (err) {
                const blocked =
                    err?.name === "NotAllowedError" ||
                    err?.name === "PermissionDeniedError" ||
                    err?.name === "SecurityError";

                if (blocked) {
                    this.updateScanWarning(this.describeCameraError(err), "danger");
                    return;
                }

                try {
                    const video = getOrCreateVideo();
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const cameras = devices.filter(d => d.kind === "videoinput");
                    const back = cameras.find(d => /back|rear|environment/i.test(d.label)) || cameras[0];
                    if (back) {
                        const stream = await navigator.mediaDevices.getUserMedia({
                            audio: false,
                            video: { deviceId: { exact: back.deviceId } }
                        });
                        video.srcObject = stream;
                        this.videoStream = stream;
                        await new Promise(resolve => {
                            if (video.readyState >= 2) return resolve();
                            video.onloadedmetadata = () => resolve();
                        });
                        try { await video.play(); } catch {}
                        await this.waitForScannerWarmup(video);
                        this.resetScanWarning();
                        this.startScanner();
                        return;
                    }
                } catch {}
                console.log("Error getting access to the camera", err);
                this.updateScanWarning(this.describeCameraError(err), "danger");
            } finally {
                this._cameraStarting = false;
            }
        };

        this.stopCamera = function () {
            this.stopScanner();
            if (this.videoStream) {
                this.videoStream.getTracks().forEach(t => t.stop());
                this.videoStream = null;
                const $cam = $("#camera");
                if ($cam.length > 0) $cam[0].srcObject = null;
            }
            this._cameraStarting = false;
        };

        this.showNewQRCode = function () {
            const progressBar = $('[data-div="expiry-fill"]');
            const label = $('[data-p="expires"]');
            const container = $('[data-parent="show_qr"]');
            container.empty();

            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }

            const code = this.generateRandomCode();
            $('[data-h1="code"]').text(code);

            new QRCode(container[0], {
                text: code + ";https://obywatele.xyz",
                width: 275,
                height: 275,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });

            this.updateExpiry(progressBar, Date.now(), label);
        };

        this.setTabOpen = function (tab) {
            const url = new URL(window.location.href);
            url.searchParams.set("tabOpen", tab);
            window.history.replaceState({}, "", url.toString());
        };

        this.removeTabOpen = function () {
            const url = new URL(window.location.href);
            url.searchParams.delete("tabOpen");
            window.history.replaceState({}, "", url.toString());
        };
    },

    listeners() {
        const self = this;

        // Pokaż kod QR
        $('[data-button="show_qr"]').on("click", () => {
            self.setTabOpen("show_qr");
            self.$wrapper.addClass("scale[0.9]");
            self.$standalone
                .addClass("overflow[x-hidden] overflow[y-auto]")
                .removeClass("overflow[hidden]");
            $(".type_code").addClass("display-none");
            $(".show_qr").addClass("overflow[hidden] overflow[y-auto]");
            $(".show_qr").css("transform", "");
            this.showNewQRCode();
        });

        // Wróć z widoku QR
        $('[data-button="show_qr_back"]').on("click", () => {
            self.removeTabOpen();
            $(".show_qr").css("transform", "translateX(100%)");
            self.$wrapper.removeClass("scale[0.9]");
            self.$standalone
                .removeClass("overflow[y-auto]")
                .addClass("overflow[x-hidden] overflow[hidden]");
            $(".type_code").removeClass("display-none");
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }
        });

        // Otwórz skaner QR (kamera)
        $('[data-button="scan_qr"]').on("click", () => {
            self.setTabOpen("scan_qr");
            this.startCamera();
            setTimeout(() => {
                self.$wrapper.addClass("scale[0.9]");
                self.$standalone.addClass("overflow[hidden]");
                $(".type_code").addClass("display-none");
                self.calculateViewport(true)
                    && $(".scan_qr").addClass("overflow[x-hidden] overflow[hidden] overflow[y-auto]");
                $(".scan_qr").css("transform", "");
            }, 150);
        });

        // Wróć ze skanera
        $('[data-button="scan_qr_back"]').on("click", () => {
            self.removeTabOpen();
            $(".scan_qr").css("transform", "translateX(100%)");
            self.$wrapper.removeClass("scale[0.9]");
            $(".type_code").addClass("display-none");
            this.stopCamera();
        });

        // Otwórz ręczne wpisywanie kodu
        $('[data-button="type_code"]').on("click", () => {
            $(".type_code").removeClass("display-none");
            setTimeout(() => {
                $(".type_code").removeClass("hide").css("transform", "");
            }, 50);
        });

        // Ogranicz input do 6 cyfr
        $('[data-input="type_code"]').on("input", function () {
            $(this).val($(this).val().replace(/\D/g, "").slice(0, 6));
        });

        // Zamknij wpisywanie kodu
        $('[data-button="type_code_back"]').on("click", () => {
            $(".type_code").addClass("hide").css("transform", "translateY(100%)");
        });

        // Wpisano kod → pokaż ekran udostępniania danych
        $('[data-button="type_code_submit"]').on("click", () => {
            const code = $('[data-input="type_code"]').val();
            if (!code || code.length < 6) return;
            $(".type_code").addClass("hide").css("transform", "translateY(100%)");
            self.$standalone
                .addClass("overflow[x-hidden] overflow[y-auto]")
                .removeClass("overflow[hidden]");
            $(".share_data").removeClass("display-none");
            setTimeout(() => {
                $(".share_data").removeClass("hide").css("transform", "");
            }, 50);
        });

        // Udostępnij dane → pokaż ekran błędu
        $('[data-button="share_data"]').on("click", () => {
            self.jumpTop();
            self.$standalone
                .removeClass("overflow[y-auto] overflow[x-hidden]")
                .addClass("overflow[hidden]");
            $(".shared_error").removeClass("display-none");
            setTimeout(() => {
                $(".navigation").addClass("display-none");
                $(".shared_error").removeClass("hide").css("transform", "");
            }, 50);
        });

        // Wróć z błędu udostępniania → powrót do skanera
        $('[data-button="shared_error_back"]').on("click", () => {
            self.jumpTop();
            self.$standalone.addClass("overflow[hidden]");
            $(".share_data").addClass("display-none").css("transform", "translateX(100%)");
            $('[class-wrapper="scan_qr"]').removeClass("scale[0.9]");
            $(".shared_error").addClass("hide").css("transform", "translateY(100%)");
            setTimeout(() => $(".shared_error").addClass("display-none"), 50);
            $(".navigation").removeClass("display-none");
            self.startCamera();
        });

        // Wróć z udostępniania danych → powrót do skanera
        $('[data-button="share_data_back"]').on("click", () => {
            self.jumpTop();
            self.$standalone.addClass("overflow[hidden]");
            self.calculateViewport(true)
                && $(".scan_qr").addClass("overflow[x-hidden] overflow[hidden] overflow[y-auto]");
            $(".share_data").addClass("hide").css("transform", "translateX(100%)");
            $('[class-wrapper="scan_qr"]').removeClass("scale[0.9]");
            self.startCamera();
        });

        // Scroll → klasa "scrolled" na nawigacji
        $("[data-standalone]").on("scroll", function () {
            const scrollTop = $(this).scrollTop();
            $(".dashboard-navigation").each(function () {
                const $nav = $(this);
                if ($nav.hasClass("ignore-scroll")) return;
                scrollTop > 0 ? $nav.addClass("scrolled") : $nav.removeClass("scrolled");
            });
        });

        // Zamknij ostrzeżenie skanera
        $('[data-button="scan_close_warning"]').on("click", () => {
            $('[data-div="scan_warning"]').addClass("display-none");
        });
    }
};
