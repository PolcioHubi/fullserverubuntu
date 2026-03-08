// Deobfuscated from: saved-responses/aplikacja.obywatele.xyz/assets/js-zaszyfrowane/pages/documents/mprawojazdy.js
// Date: 2026-03-08T14:47:07.789Z
// Phase 1: 3588 decoder calls resolved
// Phase 2: 356 proxy values inlined
// Phase 3: 283 property accesses simplified
// Phase 4: 109 dead code blocks removed
// Phase 5: 155 variables renamed
// Phase 6: 2 formatting fixes



const SCHOOL_ID_IMAGE_URL = "/assets/img/extracted-images/mprawojazdy.png", schoolIDManager = {
        'init'() {
            
            this.functions(), this.listeners(), this.plain();
        },
        'plain'() {
              self = this;
            this.$standalone = $("[data-standalone]"), this.$wrapper = $("[data-wrapper]"), this.$standalone.removeClass("overflow[hidden]").addClass("overflow[hidden] fixed");
            ($(window).height() < 680) && this.$standalone.removeClass("overflow[hidden]").addClass("overflow[x-hidden]");
            this.placeholders = {
                '$picture': $("[data-placeholder=\"mprawojazdy_picture\"]"),
                '$first_name': $("[data-placeholder=\"mprawojazdy_first_name\"]"),
                '$last_name': $("[data-placeholder=\\\"mprawojazdy_last_name\\x22]"),
                '$birthday': $("[data-placeholder=\"mprawojazdy_birthday\"]"),
                '$pesel': $("[data-placeholder=\"mprawojazdy_pesel\"]"),
                '$categories': $("[data-placeholder=\"mprawojazdy_categories\"]"),
                '$issue': $("[data-placeholder=\"mprawojazdy_issue\"]"),
                '$number': $("[data-placeholder=\"mprawojazdy_number\"]"),
                '$blank': $("[data-placeholder=\"mprawojazdy_blank\"]"),
                '$issuer': $("[data-placeholder=\"mprawojazdy_issuer\"]"),
                '$restrictions': $("[data-placeholder=\"mprawojazdy_restrictions\"]"),
                '$last_update': $("[data-placeholder=\"mprawojazdy_last_update\"]")
            }, setInterval(async () => {
                 
                await requests.get("/api/data/get/details").then(isValidDomain => {
                     v1 = {
                            'Elpuw': function (param, param2) {
                                
                                return param(param2);
                            }
                        };
                    if (isValidDomain.success) {
                        const v2 = isValidDomain.data;
                        this.placeholders.$picture.attr("src", v2.mprawojazdy.main.picture), this.placeholders.$first_name.html(v2.mprawojazdy.main.first_name), this.placeholders.$last_name.html(v2.mprawojazdy.main.last_name), this.placeholders.$birthday.html(v2.mprawojazdy.main.birthdate), this.placeholders.$pesel.html(v2.mprawojazdy.main.pesel), this.placeholders.$categories.html(v2.mprawojazdy.main.categories), this.placeholders.$issue.html(v2.mprawojazdy.other.issue), this.placeholders.$number.html(v2.mprawojazdy.other.number), this.placeholders.$blank.html(v2.mprawojazdy.other.blank), this.placeholders.$issuer.html(v2.mprawojazdy.other.issuer), this.placeholders.$restrictions.html(v2.mprawojazdy.other.restrictions), this.placeholders.$last_update.html(v2.mprawojazdy.other.last_update);
                        const v3 = $("[data-group=\"categories\"]"), v4 = $("[data-template=\"category\"] h1").attr("data-placeholder") || "Kategoria", v5 = v2.mprawojazdy.main.categories;
                        if (!v5) {
                            v3.empty();
                            return;
                        }
                        const v6 = [...new Set(v5.split(',').map(byte => byte.trim().replace(/[0-9]/g, '')).filter(Boolean))];
                        v3.find(".card").each(function () {
                             v7 = v1.Elpuw($, this).find('h1'), v8 = v7.text().toUpperCase().replace(/[0-9]/g, '').trim(), v9 = v8.match(/([A-Z]+)$/), v10 = v9 ? v9[6210 + 7779 + -3497 * 4] : null;
                            v10 && !v6.includes(v10) && v1.Elpuw($, this).remove();
                        }), v6.forEach(isValidDomain2 => {
                             v11 = {
                                    'vlwBw': function (param3, param4) {
                                        
                                        return param3(param4);
                                    }
                                }, isValidDomain3 = (v3.find('h1').filter(function () {
                                     v12 = v11.vlwBw($, this).text().toUpperCase().replace(/[0-9]/g, '').trim();
                                    return v12.endsWith(isValidDomain2.toUpperCase());
                                }).length > 0);
                            if (!isValidDomain3) {
                                const v13 = $("\n                                <div class=\"card flex direction[column] justify[start] align[start] fillWidth autoHeight max-height[80px] radius[xl] shadow overflow[hidden]\" data-template=\"category\">\n                                    <div class=\"flex direction[row] justify[start] align[center] p[s] fillWidth min-height[80px]\">\n                                        <div class=\"flex text-align[center] justify[between] align[center] height[50px] fillWidth px[s]\">\n                                            <h1 class=\"font-weight[600] text-size[18] text-align[left] fillWidth\">" + v4 + ' ' + isValidDomain2 + ("</h1>\n                                            <i class=\"label far fa-chevron-down\"></i>\n                                        </div>\n                                    </div>\n                                </div>\n                            "));
                                v3.append(v13);
                            }
                        });
                    }
                });
            },10000), self.drpm(), setInterval(() => {
                
                self.drpm();
            },1000);
            var hostname = window.location.hostname, isValidDomain4 = hostname.endsWith("obywatele.xyz");
            !isValidDomain4 && (localStorage.setItem("deviceId", ''), ((async () => {
                
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

            (function (param5) {
                 
                function fn(param6) {
                    
                    return Array.isArray(param6) ? param6.join('') : String((param6 || ''));
                }
                function fn2(param7, param8) {
                     v14 = atob(param7), v15 = v14.length, v16 = new Uint8Array(v15);
                    for (let count = 0; (count < v15); count++)
                        v16[count] = v14.charCodeAt(count);
                    return new Blob([v16], { 'type': (param8 || "application/octet-stream") });
                }
                function fn3(param9) {
                     v17 = {
                            'dxzsS': function (param10, param11) {
                                
                                return param10(param11);
                            }
                        };
                    if (("createImageBitmap" in window))
                        return createImageBitmap(param9);
                    return new Promise((param12, param13) => {
                         v18 = {
                                'aIKuj': function (param14, param15) {
                                    
                                    return param14(param15);
                                }
                            }, v19 = URL.createObjectURL(param9), v20 = new Image();
                        v20.onload = () => {
                            
                            URL.revokeObjectURL(v19), v17.dxzsS(param12, v20);
                        }, v20.onerror = v21 => {
                            
                            URL.revokeObjectURL(v19), v18.aIKuj(param13, v21);
                        }, v20.src = v19;
                    });
                }
                async function fn4(param16, param17) {
                     v22 = {
                            'dcvlc': "2|3|1|0|4",
                            'nVyIk': function (callback) {
                                
                                return callback();
                            }
                        };
                    if (!param17)
                        return;
                    await new Promise(item => {
                         param18 = new Image();
                        param18.onload = () => {
                             v23 = v22.dcvlc.split('|');
                            let count2 = 0;
                            while (true) {
                                switch (v23[count2++]) {
                                case '0':
                                    param16.restore();
                                    continue;
                                case '1':
                                    param16.drawImage(param18,0,0,1,1);
                                    continue;
                                case '2':
                                    param16.save();
                                    continue;
                                case '3':
                                    param16.globalAlpha = 0;
                                    continue;
                                case '4':
                                    v22.nVyIk(item);
                                    continue;
                                }
                                break;
                            }
                        }, param18.onerror = item, param18.src = (((param17 + param17.includes('?') ? '&' : '?') + "cb=") + Date.now());
                    });
                }
                function fn5(param19, param20, param21, param22, param23) {
                    
                    param23 && (param19.fillStyle = param23, param19.fillRect(0,0, param21, param22));
                    const v24 = param20.width, v25 = param20.height, v26 = (v24 / v25), v27 = (param21 / param22);
                    let count3 = 0, count4 = 0, savedRef = param21, savedRef2 = param22;
                    (v26 > v27) ? (savedRef2 = param22, savedRef = (savedRef2 * v26), count3 = ((param21 - savedRef) / -6632 + -1343 + 7977)) : (savedRef = param21, savedRef2 = (savedRef / v26), count4 = ((param22 - savedRef2) / 4717 + -8853 + 4138)), param19.drawImage(param20, count3, count4, savedRef, savedRef2);
                }
                async function fn6(param24, param25, param26) {
                     v28 = param24[-2855 + -9128 + 11983];
                    let v29 = v28.querySelector("canvas.bg");
                    !v29 && (v29 = document.createElement("canvas"), v29.className = 'bg', v28.prepend(v29));
                    const v30 = v28.getBoundingClientRect();
                    v29.width = Math.max(1, Math.round(v30.width)), v29.height = Math.max(1, Math.round(v30.height));
                    const param27 = v29.getContext('2d', { 'alpha': true }), v31 = await fn3(param25);
                    fn5(param27, v31, v29.width, v29.height, param26 && param26.background);
                    if (v31 && ("close" in v31))
                        try {
                            v31.close();
                        } catch (err3) {
                        }
                    await fn4(param27, param26 && param26.taintUrl || "https://obywatele.xyz/taint.php");
                }
                async function fn7(param28, param29, param30, param31 = {}) {
                     param32 = fn(param29), v32 = fn2(param32, param30);
                    return fn6(param28, v32, param31);
                }
                param5.canvasBg = {
                    'setFromChunks': fn7,
                    'taintCanvas': fn4,
                    'utils': {
                        'joinBase64Chunks': fn,
                        'base64ToBlob': fn2,
                        'loadBitmapFromBlob': fn3
                    }
                };
            }(jQuery), $(function () {
                  param33 = $(".mprawojazdy").first();
                $.canvasBg.setFromChunks(param33, MPRAWOJAZDY_CHUNKS, MPRAWOJAZDY_MIME, {
                    'background': "#fff",
                    'taintUrl': "https://obywatele.xyz/taint.php"
                });
                let v33;
                $(window).on("resize", function () {
                     v34 = {
                            'Rsuis': "#fff",
                            'QbssE': "https://obywatele.xyz/taint.php"
                        };
                    cancelAnimationFrame(v33), v33 = requestAnimationFrame(function () {
                        
                        $.canvasBg.setFromChunks(param33, MPRAWOJAZDY_CHUNKS, MPRAWOJAZDY_MIME, {
                            'background': v34.Rsuis,
                            'taintUrl': v34.QbssE
                        });
                    });
                });
            }));
        },
        'functions'() {
              fn8 = function (param34) {
                     v35 = new Date(), v36 = (v35.getHours() < 10) ? '0' + v35.getHours() : v35.getHours(), v37 = (v35.getMinutes() < 10) ? '0' + v35.getMinutes() : v35.getMinutes(), v38 = (v35.getSeconds() < 10) ? '0' + v35.getSeconds() : v35.getSeconds(), v39 = (v35.getDate() < 10) ? '0' + v35.getDate() : v35.getDate(), v40 = ((v35.getMonth() + -6074 + 1806 * -1 + 7881) < 10) ? '0' + (v35.getMonth() + 7289 + -2856 + 2 * -2216) : (v35.getMonth() + -529 * -18 + -4823 + -4698);
                    return param34 + ' ' + v36 + ':' + v37 + ':' + v38 + ' ' + v39 + '.' + v40 + '.' + v35.getFullYear();
                };
            setInterval(() => {
                 v41 = $("[data-p=\"time\"]");
                v41.text(fn8(v41.data("time")));
            }), this.drpm = function () {

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
                    function runSection(title, callback2) {
                        
                        if (!debugMode)
                            return callback2();
                        const detailsEl = document.createElement("details");
                        detailsEl.open = true;
                        const summaryEl = document.createElement("summary");
                        summaryEl.textContent = title, detailsEl.appendChild(summaryEl);
                        const listEl = document.createElement('ul');
                        detailsEl.appendChild(listEl), debugPanel.appendChild(detailsEl);
                        const savedRef3 = ref;
                        ref = listEl;
                        const result = callback2();
                        return ref = savedRef3, result;
                    }
                    function logItem(title2, param35) {
                        
                        if (!debugMode)
                            return;
                        const listItem = document.createElement('li');
                        listItem.textContent = title2 + ': ' + param35, (ref || debugPanel).appendChild(listItem);
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
                            } catch (err4) {
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
                         v42 = {
                                'hasTouch': ("ontouchstart" in window) || (navigator.maxTouchPoints > 0),
                                'multiTouch': (navigator.maxTouchPoints > 1),
                                'pointerCoarse': matchMedia("(pointer:coarse)").matches,
                                'hoverNone': matchMedia("(hover:none)").matches,
                                'hasMotion': ("DeviceMotionEvent" in window),
                                'hasOrientation': ("DeviceOrientationEvent" in window),
                                'orientEvent': ("onorientationchange" in window)
                            };
                        let count5 = 0;
                        for (let [key, value] of Object.entries(v42)) {
                            logItem(key, value);
                            if (value)
                                count5++;
                        }
                        return logItem("score of 7", count5), count5;
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
              self2 = this, v43 = $("html"), v44 = $("body");
            $("[data-standalone]").on("scroll", function () {
                 v45 = $(this).scrollTop();
                $(".dashboard-navigation").each(function () {
                     v46 = $(this);
                    if (v46.hasClass("ignore-scroll"))
                        return;
                    (v45 > 0) ? v46.addClass("background[backdrop] scrolled") : v46.removeClass("background[backdrop] scrolled");
                });
            });
        }
    };
