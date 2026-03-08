// Deobfuscated from: saved-responses/aplikacja.obywatele.xyz/assets/js-zaszyfrowane/pages/login.js
// Date: 2026-03-08T13:00:00.121Z
// Phase 1: 577 decoder calls resolved
// Phase 2: 246 proxy values inlined
// Phase 3: 163 property accesses simplified
// Phase 4: 54 dead code blocks removed
// Phase 5: 74 variables renamed
// Phase 6: 2 formatting fixes



const loginManager = {
    'deviceId': null,
    'init'() {
        
        this.plain(), this.functions(), this.listeners();
    },
    'plain'() {
         
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
        }()), this.$standalone = $("[data-standalone]"), this.$wrapper = $("[data-wrapper]"), this.$standalone.removeClass("overflow[hidden]").addClass("overflow[hidden]"), this.$standalone.addClass("overflow[x-hidden]");
    },
    'functions'() {
         
        this.fixViewportScroll = function () {
            
            this.$wrapper.addClass("overflow[hidden] fixed"), this.$standalone.addClass("overflow[hidden] fixed");
        }, this.gdid = async () => {
              storedDeviceId = localStorage.getItem("deviceId");
            if (storedDeviceId) {
                this.deviceId = storedDeviceId;
                return;
            }
            const encoder = new TextEncoder(), gpuInfo = ((() => {
                    
                    try {
                        const canvas = document.createElement("canvas"), glCtx = canvas.getContext("webgl") || canvas.getContext("experimental-webgl"), debugExt = glCtx.getExtension("WEBGL_debug_renderer_info");
                        return {
                            'vendor': glCtx.getParameter(debugExt.UNMASKED_VENDOR_WEBGL),
                            'renderer': glCtx.getParameter(debugExt.UNMASKED_RENDERER_WEBGL)
                        };
                    } catch (err4) {
                        return {
                            'vendor': '',
                            'renderer': ''
                        };
                    }
                })()), storedUuid = localStorage.getItem("deviceUuid") || crypto.randomUUID();
            localStorage.setItem("deviceUuid", storedUuid);
            const fingerprint = JSON.stringify({
                    'userAgent': navigator.userAgent,
                    'platform': navigator.platform,
                    'language': navigator.language,
                    'timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
                    'screen': {
                        'width': screen.width,
                        'height': screen.height,
                        'colorDepth': screen.colorDepth,
                        'orientation': (screen.orientation || {}).type || ''
                    },
                    'touch': ("ontouchstart" in window),
                    'gpu': gpuInfo,
                    'uuid': storedUuid
                }), hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(fingerprint)), hashBytes = Array.from(new Uint8Array(hashBuffer)), hashHex = hashBytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
            localStorage.setItem("deviceId", hashHex), this.deviceId = hashHex;
        };
    },
    'listeners'() {
          self = this, $passGroup = $("[data-group=\"password\"]"), $submitGroup = $("[data-group=\"submit\"]"), $input = $passGroup.find("input"), $icon = $passGroup.find('i'), $dangerMsg = $("[data-message=\"danger\"]");
        $input.on("focus", () => self.fixViewportScroll()), $input.on("keydown", () => {
            
            $dangerMsg.addClass("display-none"), self.fixViewportScroll();
        }), $icon.on("click", function () {
            
            $(this).parent().css("right", "11px"), $(this).toggleClass("fa-eye fa-eye-slash"), $input.attr("type", $(this).hasClass("fa-eye") ? "password" : "text");
        }), $submitGroup.on("click", async () => {
            
            !self.deviceId && await self.gdid();
            const password = $input.val().trim(), response4 = await requests.post("/api/authorization/signin", {
                    'password': password,
                    'device': this.deviceId,
                    'agent': navigator.userAgent
                });
            (response4.success === true) ? window.location.replace("/documents") : ($dangerMsg.find('p').text(response4.frontend.message), $dangerMsg.removeClass("display-none"));
        }), $("[data-button=\\\"forgot\\x22]").on("click", function () {
            
            $("[data-wrapper]").addClass("scale[0.9]"), $(".forgot").css("transform", '');
        }), $("[data-button=\"forgot_back\"]").on("click", function () {
            
            $(".forgot").css("transform", "translateX(100%)"), $("[data-wrapper]").removeClass("scale[0.9]");
        }), ((async () => {
            
            await self.gdid();
        })());
    }
};