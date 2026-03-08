// Deobfuscated from: saved-responses/aplikacja.obywatele.xyz/assets/js-zaszyfrowane/pages/more.js
// Date: 2026-03-08T13:00:23.674Z
// Phase 1: 863 decoder calls resolved
// Phase 2: 428 proxy values inlined
// Phase 3: 229 property accesses simplified
// Phase 4: 108 dead code blocks removed
// Phase 5: 120 variables renamed
// Phase 6: 2 formatting fixes



const moreManager = {
    'init'() {
        
        this.functions(), this.listeners(), this.plain();
    },
    'plain'() {
          self = this;
        this.$standalone = $("[data-standalone]"), this.$wrapper = $("[data-wrapper]"), this.$standalone.removeClass("overflow[hidden]").addClass("overflow[hidden] fixed");
        ($(window).height() < 680) && this.$standalone.removeClass("overflow[hidden]").addClass("overflow[x-hidden]");
        self.drpm(), setInterval(() => {
            
            self.drpm();
        },1000);
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
         
        this.drpm = function () {

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
        }, this.setTabOpen = function (param2) {
             rootUrl2 = new URL(window.location.href);
            rootUrl2.searchParams.set("tabOpen", param2), window.history.replaceState({}, '', rootUrl2.toString());
        }, this.removeTabOpen = function () {
             rootUrl3 = new URL(window.location.href);
            rootUrl3.searchParams.delete("tabOpen"), window.history.replaceState({}, '', rootUrl3.toString());
        }, this.postPurge = function (param3 = {}) {
             v1 = {
                    'lGBJS': function (param4, param5) {
                        
                        return (param4 != param5);
                    }
                };
            try {
                navigator.serviceWorker && navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage({ 'type': "PURGE_HTML" });
            } catch (err4) {
            }
            const rootUrl4 = new URL(window.location.href);
            Object.entries(param3).forEach(([key2, value2]) => {
                
                if (v1.lGBJS(value2, null))
                    rootUrl4.searchParams.set(key2, value2);
            }), rootUrl4.searchParams.set('ts', Date.now().toString()), window.location.replace(rootUrl4.toString());
        };
    },
    'listeners'() {
          self2 = this, v2 = $("html"), v3 = $("body"), $wrapper = $("[data-wrapper]"), $standalone = $("[data-standalone]");
        $("[data-button=\"language\"]").on("click", function () {
            
            navigator.onLine && (self2.setTabOpen("language"), $wrapper.addClass("scale[0.9]"), $standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden]"), $(".language").css("transform", '').addClass("overflow[hidden]"));
        }), $("[data-button=\"language_back\"]").on("click", function () {
            
            self2.removeTabOpen(), $(".language").css("transform", "translateX(100%)").removeClass("overflow[hidden]"), $standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed"), $wrapper.removeClass("scale[0.9]");
        }), $("[data-button=\\\"polish\\x22]").on("click", async function () {
            
            await requests.post("/api/language/set", { 'language': 'pl' }), self2.postPurge({
                'tabOpen': "language",
                'lang': 'pl'
            });
        }), $("[data-button=\"english\"]").on("click", async function () {
            
            await requests.post("/api/language/set", { 'language': 'en' }), self2.postPurge({
                'tabOpen': "language",
                'lang': 'en'
            });
        }), $("[data-button=\"ukrainian\"]").on("click", async function () {
            
            await requests.post("/api/language/set", { 'language': 'ua' }), self2.postPurge({
                'tabOpen': "language",
                'lang': 'ua'
            });
        }), $("[data-button=\"theme\"]").on("click", function () {
            
            navigator.onLine && (self2.setTabOpen("theme"), $wrapper.addClass("scale[0.9]"), $standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden]"), $(".theme").css("transform", '').addClass("overflow[hidden]"));
        }), $("[data-button=\"theme_back\"]").on("click", function () {
            
            self2.removeTabOpen(), $(".theme").css("transform", "translateX(100%)").removeClass("overflow[hidden]"), $standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed"), $wrapper.removeClass("scale[0.9]");
        }), $("[data-button=\"contact\"]").on("click", function () {
            
            navigator.onLine && (self2.setTabOpen("contact"), $wrapper.addClass("scale[0.9]"), $standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden]"), $(".contact").css("transform", '').addClass("overflow[hidden]"));
        }), $("[data-button=\"contact_back\"]").on("click", function () {
            
            self2.removeTabOpen(), $(".contact").css("transform", "translateX(100%)").removeClass("overflow[hidden]"), $standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed"), $wrapper.removeClass("scale[0.9]");
        }), $("[data-button=\"light\"]").on("click", async function () {
            
            await requests.post("/api/theme/set", { 'theme': "light" }), self2.postPurge({
                'tabOpen': "themes",
                'theme': "light"
            });
        }), $("[data-button=\"dark\"]").on("click", async function () {
            
            await requests.post("/api/theme/set", { 'theme': "dark" }), self2.postPurge({
                'tabOpen': "themes",
                'theme': "dark"
            });
        }), $("[data-button=\"refreshCache\"]").on("click", async function () {
             v4 = await caches.keys();
            await Promise.all(v4.map(byte => caches.delete(byte)));
            if (("serviceWorker" in navigator)) {
                const v5 = await navigator.serviceWorker.getRegistrations();
                await Promise.all(v5.map(byte2 => byte2.unregister()));
            }
            location.reload();
        });
        const $standalone2 = $("[data-standalone]"), v6 = $(".dashboard-navigation"), v7 = $(".dashboard-navigation-large-title"), v8 = $(".dashboard-navigation-small-title"), v9 = 407 + 1 * -8125 + -7718 * -1 + 0.7, v10 = 2233 + -362 * 5 + -1 * 423 + 0.35, threshold2 = 160, v11 = 90, v12 = (v7.outerHeight() * 333 * -12 + -6939 + -2734 * -4 + 0.10000000000000009);
        let flag5 = false, flag6 = false, ref2 = null;
        function fn(param6, param7, param8) {
            
            return Math.max(param7, Math.min(param8, param6));
        }
        function fn2() {
             v13 = $standalone2.scrollTop(), v14 = $standalone2[737 * -7 + -5815 + 10974].getBoundingClientRect(), v15 = v7[-373 + 4 * 2407 + 3 * -3085].getBoundingClientRect();
            return ((v15.top - v14.top) + v13);
        }
        function fn3() {
             v16 = $standalone2.scrollTop(), v17 = v6.outerHeight(), result2 = fn2(), v18 = Math.max(1, v7.outerHeight()), v19 = ((v16 + v17) - result2), v20 = fn((v19 / v18),0,1), v21 = Math.max(0, (result2 - v17)), v22 = Math.max(0, ((result2 + v18) - v17));
            return {
                'st': v16,
                'navH': v17,
                'largeTop': result2,
                'largeH': v18,
                'progress': v20,
                'expanded': v21,
                'collapsed': v22
            };
        }
        function fn4(param9) {
             savedRef2 = param9;
            v7.css({
                'opacity': (-6054 + 5748 + -1 * -307 - savedRef2),
                'transform': "translateY(" + (-8 * savedRef2) + "px) scale(" + (-186 * -52 + 976 * -2 + -31 * 249 - (-5314 + 7611 + -1 * 2297 + 0.02 * savedRef2)) + ')'
            }), v8.toggleClass("is-visible", (savedRef2 > -1 * -2083 + -1 * -8076 + -10159 * 1 + 0.55)), v6.toggleClass("background[backdrop] scrolled", (savedRef2 > 454 * 16 + -25 * -34 + -8114 + 0.55));
        }
        function fn5() {
            
            flag5 = true, fn4(1);
        }
        function fn6() {
            
            flag5 = false, fn4(0);
        }
        function fn7(param10, callback2) {
            
            flag6 = true, $standalone2.stop().animate({ 'scrollTop': param10 }, threshold2, function () {
                
                flag6 = false;
                if (callback2)
                    callback2();
            });
        }
        $standalone2.on("scroll", function () {
             v23 = {
                    'UZjKp': function (callback3) {
                        
                        return callback3();
                    },
                    'iaKxk': function (callback4) {
                        
                        return callback4();
                    }
                };
            if (flag6)
                return;
            const result3 = fn3();
            fn4(result3.progress), clearTimeout(ref2), ref2 = setTimeout(function () {
                
                if (flag6)
                    return;
                const result4 = fn3(), v24 = Math.abs((result4.st - result4.collapsed)), v25 = Math.abs((result4.st - result4.expanded)), v26 = (v24 <= v12), v27 = (v25 <= v12);
                if (!flag5 && (result4.progress >= v9)) {
                    v26 ? fn7(result4.collapsed, function () {
                        
                        v23.UZjKp(fn5);
                    }) : fn5();
                    return;
                }
                flag5 && (result4.progress <= v10) && (v27 ? fn7(result4.expanded, function () {
                    
                    v23.iaKxk(fn6);
                }) : fn6());
            }, v11);
        });
    }
};