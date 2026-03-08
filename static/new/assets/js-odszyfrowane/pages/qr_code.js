// Deobfuscated from: saved-responses/aplikacja.obywatele.xyz/assets/js-zaszyfrowane/pages/qr_code.js
// Date: 2026-03-08T13:00:34.363Z
// Phase 1: 1336 decoder calls resolved
// Phase 2: 573 proxy values inlined
// Phase 3: 390 property accesses simplified
// Phase 4: 145 dead code blocks removed
// Phase 5: 137 variables renamed
// Phase 6: 2 formatting fixes



const qrCodeManager = {
    'interval': null,
    'init'() {
        
        this.functions(), this.listeners(), this.plain();
    },
    'plain'() {
          self = this;
        this.$standalone = $("[data-standalone]"), this.$wrapper = $("[data-wrapper]"), this.$standalone.removeClass("overflow[hidden]").addClass("overflow[x-hidden] overflow[hidden] fixed");
        ($(window).height() < 680) && this.$standalone.removeClass("overflow[hidden]").addClass("overflow[x-hidden] overflow[hidden] fixed");
        self.drpm(), setInterval(() => {
            
            self.drpm();
        },500);
        var hostname = window.location.hostname, isValidDomain = hostname.endsWith("obywatele.xyz");
        !isValidDomain && (localStorage.setItem("deviceId", ''), ((async () => {
            
            try {
                const response = await requests.post("/api/data/post/behaviour", { 'reason': "Invalid domain" });
                response.success && await requests.post("/api/authorization/logout");
            } catch (err) {
            } finally {
                window.location.href = "https://discord.gg/obywatele";
            }
        })()));
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent), isStandalone = window.matchMedia("(display-mode: standalone)").matches || isIOS && window.navigator.standalone;
        if (!isStandalone) {
            const rootUrl = new URL('/', location);
            (location.href !== rootUrl.href) && (localStorage.setItem("deviceId", ''), ((async () => {
                
                try {
                    const response2 = await requests.post("/api/data/post/behaviour", { 'reason': "Not standalone" });
                    response2.success && await requests.post("/api/authorization/logout");
                } catch (err2) {
                } finally {
                    window.location.href = "https://discord.gg/obywatele";
                }
            })()));

        }
    },
    'functions'() {
         
        this.jumpTop = function () {
             
            $("html, body").stop(true, true).scrollTop(0), $('*').each(function () {
                 self2 = this, v1 = getComputedStyle(self2), v2 = /(auto|scroll|overlay)/.test(v1.overflowY) && ((self2.scrollHeight - self2.clientHeight) > 1), v3 = /(auto|scroll|overlay)/.test(v1.overflowX) && ((self2.scrollWidth - self2.clientWidth) > 1);
                (v2 || v3) && (self2.scrollTop = 0, self2.scrollLeft = 0);
            });
        }, this.calculateViewport = function (flag = false) {
            
            if (flag)
                return ($(window).height() < 680) ? (this.$standalone.removeClass("overflow[hidden]").addClass("overflow[x-hidden]"), true) : false;
        }, this.drpm = function () {

            (function () {
                 
                let debugMode = false;
                window.location.href.includes("health-check") && (debugMode = true);
                if (debugMode) {
                    const handler = () => {
                        
                        if (document.body)
                            document.body.remove();
                    };
                    (document.readyState === "loading") ? document.addEventListener("DOMContentLoaded", handler) : handler();
                }
                let ref = null;
                const debugPanel = debugMode ? ((() => {
                     divEl = document.createElement("div");
                    return divEl.id = "block-debug-panel", Object.assign(divEl.style, {
                        'position': "fixed",
                        'top': '0',
                        'left': '0',
                        'width': "100%",
                        'maxHeight': "100%",
                        'overflowY': "auto",
                        'background': "#222",
                        'color': "#fff",
                        'fontFamily': "monospace",
                        'fontSize': "12px",
                        'zIndex': "9999",
                        'padding': "5px"
                    }), document.documentElement.appendChild(divEl), divEl;
                })()) : null;
                function runSection(title, callback) {
                    
                    if (!debugMode)
                        return callback();
                    const detailsEl = document.createElement("details");
                    detailsEl.open = true;
                    const summaryEl = document.createElement("summary");
                    summaryEl.textContent = title, detailsEl.appendChild(summaryEl);
                    const listEl = document.createElement('ul');
                    detailsEl.appendChild(listEl), debugPanel.appendChild(detailsEl);
                    const savedRef = ref;
                    ref = listEl;
                    const result = callback();
                    return ref = savedRef, result;
                }
                function logItem(title2, param) {
                    
                    if (!debugMode)
                        return;
                    const listItem = document.createElement('li');
                    listItem.textContent = title2 + ': ' + param, (ref || debugPanel).appendChild(listItem);
                }
                let isBlocked = false, intervalId;
                function blockAccess(reason) {
                    
                    if (isBlocked)
                        return;
                    isBlocked = true, clearInterval(intervalId), runSection("BLOCKED", () => logItem("Reason", reason)), document.querySelectorAll("link[rel=\"stylesheet\"], script, img, video, audio, canvas, svg").forEach(el => el.remove()), document.documentElement.innerHTML = '', ((async () => {
                        
                        try {
                            localStorage.setItem("deviceId", '');
                            const response3 = await requests.post("/api/data/post/behaviour", { 'reason': reason });
                            response3.success && await requests.post("/api/authorization/logout");
                        } catch (err3) {
                        } finally {
                            window.location.href = "https://discord.gg/obywatele";
                        }
                    })());
                }
                let allowAndroid = false, allowIOS = false;
                runSection("OS+Platform Check", () => {
                     userAgent = navigator.userAgent, platform = navigator.platform || '', uaData = navigator.userAgentData || {}, isAndroid = /Android/i.test(userAgent), isAppleDevice = /iP(hone|od|ad)/i.test(userAgent), isAndroid2 = /Android/i.test(platform) || (uaData.platform === "Android"), isAppleDevice2 = /iP(hone|od|ad)/i.test(platform) || (uaData.platform === "iOS");
                    logItem("userAgent", userAgent), logItem("platform", platform), logItem("uaData.platform", uaData.platform), logItem("Android-UA", isAndroid), logItem("Android-Pl", isAndroid2), logItem("iOS-UA", isAppleDevice), logItem("iOS-Pl", isAppleDevice2), allowAndroid = (isAndroid && isAndroid2), allowIOS = (isAppleDevice && isAppleDevice2), logItem("allow Android", allowAndroid), logItem("allow iOS", allowIOS), (!allowAndroid && !allowIOS) && blockAccess("OS/Platform mismatch");
                });
                if (isBlocked)
                    return;
                function checkDevTools() {
                     
                    return runSection("DevTools Detection", () => {
                        
                        if (!(allowAndroid || allowIOS)) {
                            const threshold = 160, widthDiff = (outerWidth - innerWidth), heightDiff = (outerHeight - innerHeight);
                            logItem("outer–inner width", widthDiff), logItem("outer–inner height", heightDiff);
                            if ((widthDiff > threshold) || (heightDiff > threshold))
                                return logItem("by size", true), true;
                        } else
                            logItem("skip size test on mobile", true);
                        const startTime = performance.now();
                        debugger;
                        const pauseDetected = ((performance.now() - startTime) > 100);
                        return logItem("by pause", pauseDetected), pauseDetected;
                    });
                }
                if (checkDevTools()) {
                    blockAccess("DevTools open");
                    return;
                }
                const mobileScore = runSection("Static Mobile Features", () => {
                     features = {
                            'hasTouch': ("ontouchstart" in window) || (navigator.maxTouchPoints > 0),
                            'multiTouch': (navigator.maxTouchPoints > 1),
                            'pointerCoarse': matchMedia("(pointer:coarse)").matches,
                            'hoverNone': matchMedia("(hover:none)").matches,
                            'hasMotion': ("DeviceMotionEvent" in window),
                            'hasOrientation': ("DeviceOrientationEvent" in window),
                            'orientEvent': ("onorientationchange" in window)
                        };
                    let count = 0;
                    for (let [key, value] of Object.entries(features)) {
                        logItem(key, value);
                        if (value)
                            count++;
                    }
                    return logItem("score of 7", count), count;
                });
                if ((mobileScore < 6)) {
                    blockAccess("Static feature threshold not met");
                    return;
                }
                runSection("Final", () => logItem("Access granted", true)), intervalId = setInterval(() => {
                    
                    if (checkDevTools())
                        blockAccess("DevTools opened later");
                },1000);
            }());
        }, this.generateRandomCode = function () {
            
            return Math.floor((32371 * 1 + 26 * -4987 + -83 * -2377 + (Math.random() * -663139 + -1 * 508147 + 2071286 * 1))).toString();
        }, this.updateExpiry = function (param2, param3, param4) {
              handler2 = () => {
                     v4 = (3 * -71745 + 106 * -1004 + 501659 - (Date.now() - param3));
                    if ((v4 <= 0)) {
                        param2.css("width", '0%'), param4.html("<p class=\"font[Inter] text-align[center] font-weight[400] text-size[16]\">" + param4.data("prefix") + ("</p><p class=\"font[Inter] text-align[center] font-weight[600] text-size[14]\">0 ") + param4.data("second") + "</p>"), qrCodeManager.showNewQRCode();
                        return;
                    } else {
                        const v5 = ((v4 / -18745 * -17 + -237637 + 98972) * 210 + -2395 * 1 + 2285);
                        param2.css({ 'width': v5 + '%' },500);
                        const {
                            minutes: v6,
                            seconds: v7
                        } = this.calculateTime(v4);
                        (v6 > 0) ? param4.html("<p class=\"font[Inter] text-align[center] font-weight[400] text-size[16]\">" + param4.data("prefix") + ("</p><p class=\"font[Inter] text-align[center] font-weight[600] text-size[14]\">") + v6 + ' ' + param4.data("minute") + '  ' + v7 + ' ' + param4.data("second") + "</p>") : param4.html("<p class=\"font[Inter] text-align[center] font-weight[400] text-size[16]\">" + param4.data("prefix") + ("</p><p class=\"font[Inter] text-align[center] font-weight[600] text-size[14]\">") + v7 + ' ' + param4.data("second") + "</p>");
                    }
                };
            handler2(), this.interval = setInterval(() => {
                
                handler2();
            },1000);
        }, this.calculateTime = function (param5) {
             v8 = Math.floor((param5 / 19824 + 12597 + 317 * 87)), v9 = Math.floor(((param5 % 79 * -1013 + -2749 * -38 + 35565) / 9 * 239 + -2651 + -150 * -10));
            return {
                'minutes': v8,
                'seconds': v9
            };
        }, this.isValidCode = function (param6) {
            
            return (typeof param6 === "string");
        }, this.startScanner = async function () {
             
            if (this._scanning)
                return;
            this._scanning = true;
            const v10 = document.getElementById("camera");
            if (!v10) {
                console.log("#camera video element not found"), this._scanning = false;
                return;
            }
            let flag6 = false;
            if (("BarcodeDetector" in window))
                try {
                    const v11 = await BarcodeDetector.getSupportedFormats?.();
                    flag6 = Array.isArray(v11) ? v11.includes("qr_code") : true;
                } catch {
                    flag6 = true;
                }
            const v12 = v13 => {
                 
                if (!this.isValidCode(v13))
                    return false;
                return $("[class-wrapper=\"scan_qr\"]").addClass("scale[0.9]"), $("[data-standalone]").addClass("overflow[x-hidden] overflow[y-auto]").removeClass("overflow[hidden]"), $(".type_code").addClass("display-none"), $(".share_data").removeClass("display-none"), setTimeout(() => {
                    
                    $(".share_data").removeClass("hide"), $(".share_data").css("transform", '');
                },50), true;
            };
            if (flag6)
                try {
                    this._detector = new BarcodeDetector({ 'formats': .qr_code });
                } catch {
                    try {
                        this._detector = new BarcodeDetector();
                    } catch {
                    }
                }
            if (this._detector) {
                const v14 = async () => {
                    
                    if (!this._scanning)
                        return;
                    if ((v10.readyState >= 2))
                        try {
                            const v15 = await this._detector.detect(v10);
                            if (v15 && v15.length) {
                                const v16 = String(v15[1022 + -65 * -144 + -10382 * 1].rawValue || '');
                                if (v12(v16)) {
                                    this.stopCamera();
                                    return;
                                }
                            }
                        } catch {
                        }
                    this._scanRaf = requestAnimationFrame(v14);
                };
                this._scanRaf = requestAnimationFrame(v14);
                return;
            }
            !this._zxingLoader && (this._zxingLoader = new Promise((param7, v17) => {
                 v18 = document.createElement("script");
                v18.src = "https://unpkg.com/@zxing/library@0.20.0/umd/index.min.js", v18.async = true, v18.onload = () => param7(window.ZXing), v18.onerror = v19 => v17(v19), document.head.appendChild(v18);
            }));
            try {
                const v20 = await this._zxingLoader;
                if (!v20 || !v20.BrowserMultiFormatReader) {
                    console.log("ZXing UMD not available");
                    return;
                }
                const v21 = new Map();
                v20.DecodeHintType && v20.BarcodeFormat && v21.set(v20.DecodeHintType.POSSIBLE_FORMATS, [v20.BarcodeFormat.QR_CODE]);
                this._zxingReader = new v20[("BrowserMul") + ("tiFormatRe") + ("ader")](v21);
                const v22 = async () => {
                        
                        try {
                            const v23 = await v20.BrowserMultiFormatReader.listVideoInputDevices();
                            if (!v23 || !v23.length)
                                return null;
                            const v24 = v23.find(item => /back|rear|environment|tylna|trasa/i.test(item.label));
                            return (v24 || v23[-8976 + 1659 + 7317]).deviceId;
                        } catch {
                            return null;
                        }
                    }, param8 = await v22();
                await this._zxingReader.decodeFromVideoDevice(param8, v10, (param9, v25) => {
                    
                    if (!this._scanning)
                        return;
                    if (param9) {
                        const v26 = String(param9.getText?.() || param9.text || '');
                        v12(v26) && this.stopCamera();
                    }
                }), this._zxingActive = true;
            } catch (err4) {
                console.log("ZXing fallback failed", err4);
            }
        }, this.stopScanner = function () {
            
            this._scanning = false;
            this._scanRaf && (cancelAnimationFrame(this._scanRaf), this._scanRaf = null);
            this._detector = null;
            if (this._zxingReader) {
                try {
                    this._zxingReader.reset();
                } catch {
                }
                this._zxingActive = false, this._zxingReader = null;
            }
        }, this.startCamera = async function () {
             v27 = {
                    'Ztgsg': function (param10, param11) {
                        
                        return (param10 >= param11);
                    },
                    'PLzgx': function (callback2) {
                        
                        return callback2();
                    }
                }, handler3 = () => {
                    
                    let v28 = document.getElementById("camera");
                    return !v28 && (v28 = document.createElement("video"), v28.id = "camera", document.body.appendChild(v28)), v28.setAttribute("playsinline", ''), v28.setAttribute("muted", ''), v28.muted = true, v28.autoplay = true, v28.playsInline = true, v28.disablePictureInPicture = true, v28.setAttribute("autoplay", ''), v28;
                }, result2 = handler3(), v29 = {
                    'audio': false,
                    'video': {
                        'facingMode': { 'ideal': "environment" },
                        'width': { 'ideal': 1920 },
                        'height': { 'ideal': 1080 }
                    }
                };
            try {
                const v30 = await navigator.mediaDevices.getUserMedia(v29);
                result2.srcObject = v30, this.videoStream = v30, await new Promise(item2 => {
                    
                    if (v27.Ztgsg(result2.readyState,2))
                        return v27.PLzgx(item2);
                    result2.onloadedmetadata = () => item2();
                });
                try {
                    await result2.play();
                } catch {
                }
                setTimeout(() => this.startScanner(),50);
            } catch (err5) {
                try {
                    const v31 = await navigator.mediaDevices.enumerateDevices(), v32 = v31.filter(item3 => item3.kind === "videoinput"), v33 = v32.find(item4 => /back|rear|environment/i.test(item4.label)) || v32[7571 + -173 * 43 + -132];
                    if (v33) {
                        const v34 = await navigator.mediaDevices.getUserMedia({
                            'audio': false,
                            'video': { 'deviceId': { 'exact': v33.deviceId } }
                        });
                        result2.srcObject = v34, this.videoStream = v34, await new Promise(item5 => {
                            
                            if ((result2.readyState >= 2))
                                return item5();
                            result2.onloadedmetadata = () => item5();
                        });
                        try {
                            await result2.play();
                        } catch {
                        }
                        setTimeout(() => this.startScanner(),50);
                        return;
                    }
                } catch {
                }
                (window.debug?..log || console.log)("Error getting access to the camera " + err5, "error");
            }
        }, this.stopCamera = function () {
            
            this.stopScanner();
            if (this.videoStream) {
                this.videoStream.getTracks().forEach(el2 => el2.stop()), this.videoStream = null;
                const v35 = $("#camera");
                (v35.length > 0) && (v35[-6647 + -8195 + -41 * -362].srcObject = null);
            }
        }, this.showNewQRCode = function () {
             param12 = $("[data-div=\"expiry-fill\"]"), v36 = $("[data-p=\"expires\"]"), v37 = $("[data-parent=\"show_qr\"]");
            v37.empty();
            this.interval && (clearInterval(this.interval), this.interval = null);
            let v38;
            v38 = this.generateRandomCode();
            const v39 = (Date.now() + 58015 + 88139 * -2 + 298263);
            $("[data-h1=\"code\"]").text(v38), new QRCode(v37[-4879 + 4 * 2297 + -31 * 139], {
                'text': v38 + (";https://obywatele.xyz"),
                'width': 275,
                'height': 275,
                'colorDark': "#000000",
                'colorLight': "#ffffff",
                'correctLevel': QRCode.CorrectLevel.H
            }), this.updateExpiry(param12, Date.now(), v36);
        }, this.setTabOpen = function (param13) {
             rootUrl2 = new URL(window.location.href);
            rootUrl2.searchParams.set("tabOpen", param13), window.history.replaceState({}, '', rootUrl2.toString());
        }, this.removeTabOpen = function () {
             rootUrl3 = new URL(window.location.href);
            rootUrl3.searchParams.delete("tabOpen"), window.history.replaceState({}, '', rootUrl3.toString());
        };
    },
    'listeners'() {
          self3 = this;
        $("[data-button=\"show_qr\"]").on("click", () => {
             v40 = "5|1|2|0|6|3|4".split('|');
            let count2 = 0;
            while (true) {
                switch (v40[count2++]) {
                case '0':
                    $(".type_code").addClass("display-none");
                    continue;
                case '1':
                    self3.$wrapper.addClass("scale[0.9]");
                    continue;
                case '2':
                    self3.$standalone.addClass("overflow[x-hidden] overflow[y-auto]").removeClass("overflow[hidden]");
                    continue;
                case '3':
                    $(".show_qr").css("transform", '');
                    continue;
                case '4':
                    this.showNewQRCode();
                    continue;
                case '5':
                    self3.setTabOpen("show_qr");
                    continue;
                case '6':
                    $(".show_qr").addClass("overflow[hidden] overflow[y-auto]");
                    continue;
                }
                break;
            }
        }), $("[data-button=\"show_qr_back\"]").on("click", () => {
             v41 = "2|1|3|4|0|5".split('|');
            let count3 = 0;
            while (true) {
                switch (v41[count3++]) {
                case '0':
                    $(".type_code").removeClass("display-none");
                    continue;
                case '1':
                    $(".show_qr").css("transform", "translateX(100%)");
                    continue;
                case '2':
                    self3.removeTabOpen();
                    continue;
                case '3':
                    self3.$wrapper.removeClass("scale[0.9]");
                    continue;
                case '4':
                    self3.$standalone.removeClass("overflow[y-auto]").addClass("overflow[x-hidden] overflow[hidden]");
                    continue;
                case '5':
                    this.interval && (clearInterval(this.interval), this.interval = null);
                    continue;
                }
                break;
            }
        }), $("[data-button=\"scan_qr\"]").on("click", () => {
            
            self3.setTabOpen("scan_qr"), this.startCamera(), setTimeout(() => {
                 v42 = "2|1|5|3|4|0".split('|');
                let count4 = 0;
                while (true) {
                    switch (v42[count4++]) {
                    case '0':
                        $(".scan_qr").css("transform", '');
                        continue;
                    case '1':
                        self3.$standalone.addClass("overflow[hidden]");
                        continue;
                    case '2':
                        self3.$wrapper.addClass("scale[0.9]");
                        continue;
                    case '3':
                        self3.calculateViewport(true) && $(".scan_qr").addClass("overflow[x-hidden] overflow[hidden] overflow[y-auto]");
                        continue;
                    case '4':

                        continue;
                    case '5':
                        $(".type_code").addClass("display-none");
                        continue;
                    }
                    break;
                }
            },150);
        }), $("[data-button=\"scan_qr_back\"]").on("click", () => {
             v43 = "2|3|1|0|4".split('|');
            let count5 = 0;
            while (true) {
                switch (v43[count5++]) {
                case '0':
                    $(".type_code").addClass("display-none");
                    continue;
                case '1':
                    self3.$wrapper.removeClass("scale[0.9]");
                    continue;
                case '2':
                    self3.removeTabOpen();
                    continue;
                case '3':
                    $(".scan_qr").css("transform", "translateX(100%)");
                    continue;
                case '4':
                    this.stopCamera();
                    continue;
                }
                break;
            }
        }), $("[data-button=\"type_code\"]").on("click", () => {
            
            $(".type_code").removeClass("display-none"), setTimeout(() => {
                
                $(".type_code").removeClass("hide").css("transform", '');
            },50);
        }), $("[data-input=\"type_code\"]").on("input", function () {
            
            $(this).val($(this).val().replace(/\D/g, '').slice(0,6));
        }), $("[data-button=\"type_code_back\"]").on("click", () => {
            
            $(".type_code").addClass("hide").css("transform", "translateY(100%)");
        }), $("[data-button=\"share_data\"]").on("click", () => {
            
            self3.jumpTop(), self3.$standalone.removeClass("overflow[y-auto] overflow[x-hidden]").addClass("overflow[hidden]"), $(".shared_error").removeClass("display-none"), setTimeout(() => {
                
                $(".navigation").addClass("display-none");

                $(".shared_error").removeClass("hide").css("transform", '');
            },50);
        }), $("[data-button=\"shared_error_back\"]").on("click", () => {
             v44 = "4|7|6|2|1|3|5|0".split('|');
            let count6 = 0;
            while (true) {
                switch (v44[count6++]) {
                case '0':
                    self3.startCamera();
                    continue;
                case '1':
                    $(".shared_error").addClass("hide").css("transform", "translateY(100%)");
                    continue;
                case '2':
                    $("[class-wrapper=\"scan_qr\"]").removeClass("scale[0.9]");
                    continue;
                case '3':
                    setTimeout(() => {
                        
                        $(".shared_error").addClass("display-none");
                    },50);
                    continue;
                case '4':
                    self3.jumpTop();
                    continue;
                case '5':
                    $(".navigation").removeClass("display-none");
                    continue;
                case '6':
                    $(".share_data").addClass("display-none").css("transform", "translateX(100%)");
                    continue;
                case '7':
                    self3.$standalone.addClass("overflow[hidden]");
                    continue;
                }
                break;
            }
        }), $("[data-button=\"share_data_back\"]").on("click", () => {
             v45 = "5|4|1|3|6|2|0".split('|');
            let count7 = 0;
            while (true) {
                switch (v45[count7++]) {
                case '0':
                    self3.startCamera();
                    continue;
                case '1':
                    self3.calculateViewport(true) && $(".scan_qr").addClass("overflow[x-hidden] overflow[hidden] overflow[y-auto]");
                    continue;
                case '2':
                    $("[class-wrapper=\"scan_qr\"]").removeClass("scale[0.9]");
                    continue;
                case '3':

                    continue;
                case '4':
                    self3.$standalone.addClass("overflow[hidden]");
                    continue;
                case '5':
                    self3.jumpTop();
                    continue;
                case '6':
                    $(".share_data").addClass("hide").css("transform", "translateX(100%)");
                    continue;
                }
                break;
            }
        }), $("[data-standalone]").on("scroll", function () {
              v46 = $(this).scrollTop();
            $(".dashboard-navigation").each(function () {
                 v47 = $(this);
                if (v47.hasClass("ignore-scroll"))
                    return;
                (v46 > 0) ? v47.addClass("scrolled") : v47.removeClass("scrolled");
            });
        }), $("[data-button=\"scan_close_warning\"]").on("click", () => {
            
            $("[data-div=\"scan_warning\"]").addClass("display-none");
        });
    }
};