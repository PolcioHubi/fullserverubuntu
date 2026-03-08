// Deobfuscated from: saved-responses/aplikacja.obywatele.xyz/assets/js-zaszyfrowane/pages/services.js
// Date: 2026-03-08T13:00:09.449Z
// Phase 1: 662 decoder calls resolved
// Phase 2: 352 proxy values inlined
// Phase 3: 158 property accesses simplified
// Phase 4: 105 dead code blocks removed
// Phase 5: 119 variables renamed
// Phase 6: 2 formatting fixes



const servicesManager = {
    'init'() {
        
        this.functions(), this.listeners(), this.plain();
    },
    'plain'() {
          self = this;
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
        };
    },
    'listeners'() {
         
        $("input[type=\"text\"]").on("input", function () {
             v1 = {
                    'JRMyr': function (param2, param3) {
                        
                        return param2(param3);
                    },
                    'TNVir': ".separator\\[x\\]"
                }, v2 = $(this).val().toLowerCase().trim();
            (v2.length >= 3) ? ($(".navigation").addClass("fixed fillWidth").removeClass("sticky"), $(".card").each(function () {
                 v3 = $(this), v4 = v3.find("[data-button=\"service\"]");
                let count2 = 0;
                v4.each(function () {
                     v5 = v1.JRMyr($, this), v6 = v5.find('h1').text().toLowerCase().trim(), v7 = v2.split(' '), v8 = v6.split(' '), v9 = v7.every(item => v8.some(item2 => item2.includes(item)));
                    v5.toggle(v9), v5.next(v1.TNVir).toggle(v9);
                    if (v9)
                        count2++;
                }), (count2 > 1) ? v3.find(".separator\\[x\\]").show() : v3.find(".separator\\[x\\]").hide(), v3.toggle((count2 > 0));
            }), $("[data-title]").each(function () {
                 v10 = $(this), v11 = v10.data("title"), v12 = ($(((".card[data-group=\"" + v11) + "\"]:visible")).length > 0);
                v10.toggle(v12);
            })) : ($(".navigation").removeClass("fixed fillWidth").addClass("sticky"), $(".card").each(function () {
                
                $(this).show(), $(this).find("[data-button=\"service\"]").show(), $(this).find(".separator\\[x\\]").show();
            }), $("[data-title]").show());
        });
        const $standalone = $("[data-standalone]"), v13 = $(".dashboard-navigation"), v14 = $(".dashboard-navigation-large-title"), v15 = $(".dashboard-navigation-small-title"), v16 = 1192 + -7879 + 2229 * 3 + 0.7, v17 = 5238 + 2408 + 7646 * -1 + 0.35, threshold2 = 160, v18 = 90, v19 = (v14.outerHeight() * -1533 + 703 + 831 + 0.10000000000000009);
        let flag5 = false, flag6 = false, ref2 = null;
        function fn(param4, param5, param6) {
            
            return Math.max(param5, Math.min(param6, param4));
        }
        function fn2() {
             v20 = $standalone.scrollTop(), v21 = $standalone[3784 + 1033 * 6 + -14 * 713].getBoundingClientRect(), v22 = v14[6964 + 8431 * -1 + 1467].getBoundingClientRect();
            return ((v22.top - v21.top) + v20);
        }
        function fn3() {
             v23 = $standalone.scrollTop(), v24 = v13.outerHeight(), result2 = fn2(), v25 = Math.max(1, v14.outerHeight()), v26 = ((v23 + v24) - result2), v27 = fn((v26 / v25),0,1), v28 = Math.max(0, (result2 - v24)), v29 = Math.max(0, ((result2 + v25) - v24));
            return {
                'st': v23,
                'navH': v24,
                'largeTop': result2,
                'largeH': v25,
                'progress': v27,
                'expanded': v28,
                'collapsed': v29
            };
        }
        function fn4(param7) {
             savedRef2 = param7;
            v14.css({
                'opacity': (-3414 + 745 * -1 + 4160 - savedRef2),
                'transform': "translateY(" + (-8 * savedRef2) + "px) scale(" + (-8801 * -1 + 1 * 3805 + 2521 * -5 - (604 * 14 + 2 * -3188 + -26 * 80 + 0.02 * savedRef2)) + ')'
            }), v15.toggleClass("is-visible", (savedRef2 > 139 * 64 + -877 * -3 + -11527 * 1 + 0.55)), v13.toggleClass("background[backdrop] scrolled", (savedRef2 > 5598 + 5730 + 11328 * -1 + 0.55));
        }
        function fn5() {
            
            flag5 = true, fn4(1);
        }
        function fn6() {
            
            flag5 = false, fn4(0);
        }
        function fn7(param8, param9) {
             v30 = {
                    'moSWe': function (callback2) {
                        
                        return callback2();
                    }
                };
            flag6 = true, $standalone.stop().animate({ 'scrollTop': param8 }, threshold2, function () {
                
                flag6 = false;
                if (param9)
                    v30.moSWe(param9);
            });
        }
        $standalone.on("scroll", function () {
            
            if (flag6)
                return;
            const result3 = fn3();
            fn4(result3.progress), clearTimeout(ref2), ref2 = setTimeout(function () {
                 v31 = {
                        'Ajsdh': function (callback3) {
                            
                            return callback3();
                        },
                        'ajztq': function (callback4) {
                            
                            return callback4();
                        }
                    };
                if (flag6)
                    return;
                const result4 = fn3(), v32 = Math.abs((result4.st - result4.collapsed)), v33 = Math.abs((result4.st - result4.expanded)), v34 = (v32 <= v19), v35 = (v33 <= v19);
                if (!flag5 && (result4.progress >= v16)) {
                    v34 ? fn7(result4.collapsed, function () {
                        
                        v31.Ajsdh(fn5);
                    }) : fn5();
                    return;
                }
                flag5 && (result4.progress <= v17) && (v35 ? fn7(result4.expanded, function () {
                    
                    v31.ajztq(fn6);
                }) : fn6());
            }, v18);
        });
    }
};