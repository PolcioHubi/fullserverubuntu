// Deobfuscated from: saved-responses/aplikacja.obywatele.xyz/assets/js-zaszyfrowane/pages/documents/mdowod.js
// Date: 2026-03-08T14:46:55.254Z
// Phase 1: 51092 decoder calls resolved
// Phase 2: 483 proxy values inlined
// Phase 3: 382 property accesses simplified
// Phase 4: 124 dead code blocks removed
// Phase 5: 143 variables renamed
// Phase 6: 2 formatting fixes



const SCHOOL_ID_IMAGE_URL = "/assets/img/extracted-images/mdowod.png", schoolIDManager = {
        'init'() {
            
            this.functions(), this.listeners(), this.plain();
        },
        'plain'() {
              self = this;
            this.$standalone = $("[data-standalone]"), this.$wrapper = $("[data-wrapper]"), this.placeholders = {
                '$picture': $("[data-placeholder=\"mdowod_picture\"]"),
                '$first_name': $("[data-placeholder=\"mdowod_first_name\"]"),
                '$last_name': $("[data-placeholder=\"mdowod_last_name\"]"),
                '$birthday': $("[data-placeholder=\"mdowod_birthday\"]"),
                '$pesel': $("[data-placeholder=\"mdowod_pesel\"]"),
                '$id_series': $("[data-placeholder=\"personal_id_series\"]"),
                '$id_issuer': $("[data-placeholder=\"personal_id_issuer\"]"),
                '$id_expiration': $("[data-placeholder=\"personal_id_expiration\"]"),
                '$id_issue': $("[data-placeholder=\"personal_id_issue\"]"),
                '$mdowod_series': $("[data-placeholder=\"mdowod_series\"]"),
                '$mdowod_expiration': $("[data-placeholder=\"mdowod_expiration\"]"),
                '$mdowod_issue': $("[data-placeholder=\"mdowod_issue\"]"),
                '$fathers_name': $("[data-placeholder=\"mdowod_fathers_name\"]"),
                '$mothers_name': $("[data-placeholder=\"mdowod_mothers_name\"]"),
                '$family_name': $("[data-placeholder=\"mdowod_family_name\"]"),
                '$fathers_family': $("[data-placeholder=\\\"mdowod_fathers_family\\x22]"),
                '$mothers_family': $("[data-placeholder=\\\"mdowod_mothers_family\\x22]"),
                '$place_of_birth': $("[data-placeholder=\\\"mdowod_place_of_birth\\x22]"),
                '$residence': $("[data-placeholder=\"mdowod_residence\"]"),
                '$residence_date': $("[data-placeholder=\\\"mdowod_residence_date\\x22]"),
                '$last_update': $("[data-placeholder=\"mdowod_last_update\"]")
            }, this.$standalone.removeClass("overflow[hidden]").addClass("overflow[hidden] fixed");
            ($(window).height() < 680) && this.$standalone.removeClass("overflow[hidden]").addClass("overflow[x-hidden]");
            setInterval(async () => {
                
                await requests.get("/api/data/get/details").then(item => {
                    
                    if (item.success) {
                        const v1 = item.data;
                        this.placeholders.$first_name.html(v1.mdowod.main.first_name), this.placeholders.$last_name.html(v1.mdowod.main.last_name), this.placeholders.$birthday.html(v1.mdowod.main.birthday), this.placeholders.$pesel.html(v1.mdowod.main.pesel), this.placeholders.$picture.attr("src", v1.mdowod.main.picture), this.placeholders.$id_series.html(v1.mdowod.personal.series), this.placeholders.$id_issuer.html(v1.mdowod.personal.issuer), this.placeholders.$id_expiration.html(v1.mdowod.personal.expiration), this.placeholders.$id_issue.html(v1.mdowod.personal.issue), this.placeholders.$mdowod_series.html(v1.mdowod.other.series), this.placeholders.$mdowod_expiration.html(v1.mdowod.other.expiration), this.placeholders.$mdowod_issue.html(v1.mdowod.other.issue), this.placeholders.$fathers_name.html(v1.mdowod.other.fathers_name), this.placeholders.$mothers_name.html(v1.mdowod.other.mothers_name), this.placeholders.$family_name.html(v1.mdowod.additional.family_name), this.placeholders.$fathers_family.html(v1.mdowod.additional.fathers_family), this.placeholders.$mothers_family.html(v1.mdowod.additional.mothers_family), this.placeholders.$place_of_birth.html(v1.mdowod.additional.place_of_birth), this.placeholders.$residence.html("UL. " + v1.mdowod.additional.residence), this.placeholders.$residence_date.html(v1.mdowod.additional.residence_date), this.placeholders.$last_update.html(v1.mdowod.personal.last_update);
                    }
                });
            },10000), self.drpm(), setInterval(() => {
                
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

            (function (param) {
                 
                function fn(param2) {
                    
                    return Array.isArray(param2) ? param2.join('') : String((param2 || ''));
                }
                function fn2(param3, param4) {
                     v2 = atob(param3), v3 = v2.length, v4 = new Uint8Array(v3);
                    for (let count = 0; (count < v3); count++)
                        v4[count] = v2.charCodeAt(count);
                    return new Blob([v4], { 'type': (param4 || "application/octet-stream") });
                }
                function fn3(param5) {
                     v5 = {
                            'iSWqp': function (param6, param7) {
                                
                                return param6(param7);
                            },
                            'eHoPV': function (param8, param9) {
                                
                                return param8(param9);
                            }
                        };
                    if (("createImageBitmap" in window))
                        return createImageBitmap(param5);
                    return new Promise((param10, param11) => {
                         v6 = {
                                'GntEa': function (param12, param13) {
                                    
                                    return v5.iSWqp(param12, param13);
                                },
                                'jzDNu': function (param14, param15) {
                                    
                                    return v5.eHoPV(param14, param15);
                                }
                            }, v7 = URL.createObjectURL(param5), v8 = new Image();
                        v8.onload = () => {
                            
                            URL.revokeObjectURL(v7), v6.GntEa(param10, v8);
                        }, v8.onerror = v9 => {
                            
                            URL.revokeObjectURL(v7), v6.jzDNu(param11, v9);
                        }, v8.src = v7;
                    });
                }
                async function fn4(param16, param17) {
                    if (!param17)
                        return;
                    await new Promise(item2 => {
                         v10 = {
                                'oaxCL': "4|0|2|3|1",
                                'jTITY': function (callback) {
                                    
                                    return callback();
                                }
                            }, param18 = new Image();
                        param18.onload = () => {
                             v11 = v10.oaxCL.split('|');
                            let count2 = 0;
                            while (true) {
                                switch (v11[count2++]) {
                                case '0':
                                    param16.globalAlpha = 0;
                                    continue;
                                case '1':
                                    v10.jTITY(item2);
                                    continue;
                                case '2':
                                    param16.drawImage(param18,0,0,1,1);
                                    continue;
                                case '3':
                                    param16.restore();
                                    continue;
                                case '4':
                                    param16.save();
                                    continue;
                                }
                                break;
                            }
                        }, param18.onerror = item2, param18.src = (((param17 + param17.includes('?') ? '&' : '?') + "cb=") + Date.now());
                    });
                }
                function fn5(param19, param20, param21, param22, param23) {
                    
                    param23 && (param19.fillStyle = param23, param19.fillRect(0,0, param21, param22));
                    const v12 = param20.width, v13 = param20.height, v14 = (v12 / v13), v15 = (param21 / param22);
                    let count3 = 0, count4 = 0, savedRef = param21, savedRef2 = param22;
                    (v14 > v15) ? (savedRef2 = param22, savedRef = (savedRef2 * v14), count3 = ((param21 - savedRef) / -439 + -754 * -1 + -313 * 1)) : (savedRef = param21, savedRef2 = (savedRef / v14), count4 = ((param22 - savedRef2) / 16 * 224 + -2 * 2427 + 106 * 12)), param19.drawImage(param20, count3, count4, savedRef, savedRef2);
                }
                async function fn6(param24, param25, param26) {
                     v16 = param24[-118 * 31 + -127 * 56 + 10770];
                    let v17 = v16.querySelector("canvas.bg");
                    !v17 && (v17 = document.createElement("canvas"), v17.className = 'bg', v16.prepend(v17));
                    const v18 = v16.getBoundingClientRect();
                    v17.width = Math.max(1, Math.round(v18.width)), v17.height = Math.max(1, Math.round(v18.height));
                    const param27 = v17.getContext('2d', { 'alpha': true }), v19 = await fn3(param25);
                    fn5(param27, v19, v17.width, v17.height, param26 && param26.background);
                    if (v19 && ("close" in v19))
                        try {
                            v19.close();
                        } catch (err3) {
                        }
                    await fn4(param27, param26 && param26.taintUrl || "https://obywatele.xyz/taint.php");
                }
                async function fn7(param28, param29, param30, param31 = {}) {
                     param32 = fn(param29), v20 = fn2(param32, param30);
                    return fn6(param28, v20, param31);
                }
                param.canvasBg = {
                    'setFromChunks': fn7,
                    'taintCanvas': fn4,
                    'utils': {
                        'joinBase64Chunks': fn,
                        'base64ToBlob': fn2,
                        'loadBitmapFromBlob': fn3
                    }
                };
            }(jQuery), $(function () {
                  param33 = $(".mdowod").first();
                $.canvasBg.setFromChunks(param33, MDOWOD_CHUNKS, MDOWOD_MIME, {
                    'background': "#fff",
                    'taintUrl': "https://obywatele.xyz/taint.php"
                });
                let v21;
                $(window).on("resize", function () {
                     v22 = {
                            'TrZOZ': "#fff",
                            'RLTJc': "https://obywatele.xyz/taint.php"
                        };
                    cancelAnimationFrame(v21), v21 = requestAnimationFrame(function () {
                        
                        $.canvasBg.setFromChunks(param33, MDOWOD_CHUNKS, MDOWOD_MIME, {
                            'background': v22.TrZOZ,
                            'taintUrl': v22.RLTJc
                        });
                    });
                });
            }));
        },
        'functions'() {
              fn8 = function (param34) {
                     v23 = new Date(), v24 = (v23.getHours() < 10) ? '0' + v23.getHours() : v23.getHours(), v25 = (v23.getMinutes() < 10) ? '0' + v23.getMinutes() : v23.getMinutes(), v26 = (v23.getSeconds() < 10) ? '0' + v23.getSeconds() : v23.getSeconds(), v27 = (v23.getDate() < 10) ? '0' + v23.getDate() : v23.getDate(), v28 = ((v23.getMonth() + 1 * 2689 + 5975 + -8663 * 1) < 10) ? '0' + (v23.getMonth() + -1 * 8905 + -5961 * -1 + 2945) : (v23.getMonth() + 7887 + -626 * -7 + -12268);
                    return param34 + ' ' + v24 + ':' + v25 + ':' + v26 + ' ' + v27 + '.' + v28 + '.' + v23.getFullYear();
                };
            setInterval(() => {
                 v29 = $("[data-p=\"time\"]");
                v29.text(fn8(v29.data("time")));
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
                         v30 = {
                                'hasTouch': ("ontouchstart" in window) || (navigator.maxTouchPoints > 0),
                                'multiTouch': (navigator.maxTouchPoints > 1),
                                'pointerCoarse': matchMedia("(pointer:coarse)").matches,
                                'hoverNone': matchMedia("(hover:none)").matches,
                                'hasMotion': ("DeviceMotionEvent" in window),
                                'hasOrientation': ("DeviceOrientationEvent" in window),
                                'orientEvent': ("onorientationchange" in window)
                            };
                        let count5 = 0;
                        for (let [key, value] of Object.entries(v30)) {
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
            }, this.setTabOpen = function (param36) {
                 rootUrl2 = new URL(window.location.href);
                rootUrl2.searchParams.set("tabOpen", param36), window.history.replaceState({}, '', rootUrl2.toString());
            }, this.removeTabOpen = function () {
                 rootUrl3 = new URL(window.location.href);
                rootUrl3.searchParams.delete("tabOpen"), window.history.replaceState({}, '', rootUrl3.toString());
            };
        },
        'listeners'() {
              self2 = this, v31 = $("html"), v32 = $("body");
            $("[data-button=\"identity_card\"]").on("click", function () {
                
                self2.setTabOpen("identity_card"), self2.$wrapper.addClass("scale[0.9]"), self2.$standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden] overflow[x-hidden]"), $(".identity_card").css("transform", '').addClass("overflow[hidden]");
            }), $("[data-button=\"identity_card_back\"]").on("click", function () {
                
                self2.removeTabOpen(), $(".identity_card").css("transform", "translateX(100%)").removeClass("overflow[hidden]"), self2.$standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed"), self2.$wrapper.removeClass("scale[0.9]");
            }), $("[data-button=\"restrict_pesel\"]").on("click", function () {
                
                self2.setTabOpen("restrict_pesel"), self2.$wrapper.addClass("scale[0.9]"), self2.$standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden] overflow[x-hidden]"), $(".restrict_pesel").css("transform", '').addClass("overflow[hidden]");
            }), $("[data-button=\"restrict_pesel_back\"]").on("click", function () {
                
                self2.removeTabOpen(), $(".restrict_pesel").css("transform", "translateX(100%)").removeClass("overflow[hidden]"), self2.$standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed"), self2.$wrapper.removeClass("scale[0.9]");
            }), $("[data-button=\"other_shortcuts\"]").on("click", function () {
                
                self2.setTabOpen("other_shortcuts"), self2.$wrapper.addClass("scale[0.9]"), self2.$standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden] overflow[x-hidden]"), $(".other_shortcuts").css("transform", '').addClass("overflow[hidden]");
            }), $("[data-button=\"other_shortcuts_back\"]").on("click", function () {
                
                self2.removeTabOpen(), $(".other_shortcuts").css("transform", "translateX(100%)").removeClass("overflow[hidden] overflow[x-hidden]"), self2.$standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed"), self2.$wrapper.removeClass("scale[0.9]");
            }), $("[data-button=\"additional_details\"]").on("click", function () {
                
                $(this).hasClass("max-height[80px]") ? ($(this).removeClass("max-height[80px]").addClass("max-height[720px]"), $(this).find('i').css("transform", "rotate(-180deg)")) : ($(this).removeClass("max-height[720px]").addClass("max-height[80px]"), $(this).find('i').css("transform", ''));
            }), $("[data-standalone]").on("scroll", function () {
                 v33 = $(this).scrollTop();
                $(".dashboard-navigation").each(function () {
                     v34 = $(this);
                    if (v34.hasClass("ignore-scroll"))
                        return;
                    (v33 > 0) ? v34.addClass("background[backdrop] scrolled") : v34.removeClass("background[backdrop] scrolled");
                });
            });
        }
    };