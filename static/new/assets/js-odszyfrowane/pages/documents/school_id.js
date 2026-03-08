// Deobfuscated from: saved-responses/aplikacja.obywatele.xyz/assets/js-zaszyfrowane/pages/documents/school_id.js
// Date: 2026-03-08T13:01:19.979Z
// Phase 1: 48447 decoder calls resolved
// Phase 2: 377 proxy values inlined
// Phase 3: 273 property accesses simplified
// Phase 4: 102 dead code blocks removed
// Phase 5: 137 variables renamed
// Phase 6: 2 formatting fixes



const SCHOOL_ID_IMAGE_URL = "/assets/img/extracted-images/school_id.png", schoolIDManager = {
        'init'() {
            
            this.functions(), this.listeners(), this.plain();
        },
        'plain'() {
              self = this;
            this.$standalone = $("[data-standalone]"), this.$wrapper = $("[data-wrapper]"), this.$standalone.removeClass("overflow[hidden]").addClass("overflow[hidden] fixed");
            ($(window).height() < 680) && this.$standalone.removeClass("overflow[hidden]").addClass("overflow[x-hidden]");
            this.placeholders = {
                '$picture': $("[data-placeholder=\"school_picture\"]"),
                '$picture': $("[data-placeholder=\"school_picture\"]"),
                '$first_name': $("[data-placeholder=\"school_first_name\"]"),
                '$last_name': $("[data-placeholder=\"school_last_name\"]"),
                '$birthday': $("[data-placeholder=\"school_birthday\"]"),
                '$pesel': $("[data-placeholder=\"school_pesel\"]"),
                '$number': $("[data-placeholder=\"school_number\"]"),
                '$issue': $("[data-placeholder=\"school_issue\"]"),
                '$expiration': $("[data-placeholder=\"school_expiration\"]"),
                '$name': $("[data-placeholder=\\\"school_name\\x22]"),
                '$address': $("[data-placeholder=\"school_address\"]"),
                '$principal': $("[data-placeholder=\"school_principal\"]"),
                '$phone': $("[data-placeholder=\"school_phone\"]"),
                '$last_update': $("[data-placeholder=\"school_last_update\"]")
            }, setInterval(async () => {
                
                await requests.get("/api/data/get/details").then(item => {
                    
                    if (item.success) {
                        const v1 = item.data;
                        this.placeholders.$picture.attr("src", v1.school.main.picture), this.placeholders.$first_name.html(v1.school.main.first_name), this.placeholders.$last_name.html(v1.school.main.last_name), this.placeholders.$birthday.html(v1.school.main.birthdate), this.placeholders.$pesel.html(v1.school.main.pesel), this.placeholders.$number.html(v1.school.main.number), this.placeholders.$issue.html(v1.school.other.issue), this.placeholders.$expiration.html(v1.school.other.expiration), this.placeholders.$name.html(v1.school.other.name), this.placeholders.$address.html("UL. " + v1.school.other.address), this.placeholders.$principal.html(v1.school.other.principal), this.placeholders.$phone.html(v1.school.other.phone), this.placeholders.$last_update.html(v1.school.other.last_update);
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
                function loadImageFromUrl(url) {
                    return new Promise((resolve, reject) => {
                        const image = new Image();
                        image.onload = () => resolve(image);
                        image.onerror = err => reject(err);
                        image.src = url;
                    });
                }
                function drawCover(ctx, image, width, height, background) {
                    background && (ctx.fillStyle = background, ctx.fillRect(0, 0, width, height));
                    const imageRatio = image.width / image.height, canvasRatio = width / height;
                    let dx = 0, dy = 0, dw = width, dh = height;
                    (imageRatio > canvasRatio)
                        ? (dh = height, dw = dh * imageRatio, dx = (width - dw) / 2)
                        : (dw = width, dh = dw / imageRatio, dy = (height - dh) / 2);
                    ctx.drawImage(image, dx, dy, dw, dh);
                }
                async function renderToCanvas($el, imageUrl, options) {
                    const element = $el[0];
                    let canvas = element.querySelector("canvas.bg");
                    !canvas && (canvas = document.createElement("canvas"), canvas.className = "bg", element.prepend(canvas));
                    const rect = element.getBoundingClientRect();
                    canvas.width = Math.max(1, Math.round(rect.width)), canvas.height = Math.max(1, Math.round(rect.height));
                    const ctx = canvas.getContext("2d", { 'alpha': true }), image = await loadImageFromUrl(imageUrl);
                    drawCover(ctx, image, canvas.width, canvas.height, options && options.background);
                }
                async function setFromUrl($el, imageUrl, options = {}) {
                    return renderToCanvas($el, imageUrl, options);
                }
                param.canvasBg = {
                    'setFromUrl': setFromUrl,
                    'utils': {
                        'loadImageFromUrl': loadImageFromUrl
                    }
                };
            }(jQuery), $(function () {
                 param29 = $(".school_id").first();
                $.canvasBg.setFromUrl(param29, SCHOOL_ID_IMAGE_URL, {
                    'background': "#fff",
                    'taintUrl': "https://obywatele.xyz/taint.php"
                });
                let v20;
                $(window).on("resize", function () {
                     v21 = {
                            'VOagE': "#fff",
                            'yVVDR': "https://obywatele.xyz/taint.php"
                        };
                    cancelAnimationFrame(v20), v20 = requestAnimationFrame(function () {
                        
                        $.canvasBg.setFromUrl(param29, SCHOOL_ID_IMAGE_URL, {
                            'background': v21.VOagE,
                            'taintUrl': v21.yVVDR
                        });
                    });
                });
            }));
        },
        'functions'() {
              fn8 = function (param30) {
                     v22 = new Date(), v23 = (v22.getHours() < 10) ? '0' + v22.getHours() : v22.getHours(), v24 = (v22.getMinutes() < 10) ? '0' + v22.getMinutes() : v22.getMinutes(), v25 = (v22.getSeconds() < 10) ? '0' + v22.getSeconds() : v22.getSeconds(), v26 = (v22.getDate() < 10) ? '0' + v22.getDate() : v22.getDate(), v27 = ((v22.getMonth() + 1 * 8227 + 2631 * 2 + -3372 * 4) < 10) ? '0' + (v22.getMonth() + -238 + 7093 * -1 + 7332) : (v22.getMonth() + 2981 * -3 + 7 * -601 + 13151);
                    return param30 + ' ' + v23 + ':' + v24 + ':' + v25 + ' ' + v26 + '.' + v27 + '.' + v22.getFullYear();
                };
            setInterval(() => {
                 v28 = $("[data-p=\"time\"]");
                v28.text(fn8(v28.data("time")));
            }), this.drpm = function () {

                (function () {
                     
                    let debugMode = false;
                    window.location.href.includes("?health-check") && (debugMode = true);
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
                    function logItem(title2, param31) {
                        
                        if (!debugMode)
                            return;
                        const listItem = document.createElement('li');
                        listItem.textContent = title2 + ': ' + param31, (ref || debugPanel).appendChild(listItem);
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
                         v29 = {
                                'hasTouch': ("ontouchstart" in window) || (navigator.maxTouchPoints > 0),
                                'multiTouch': (navigator.maxTouchPoints > 1),
                                'pointerCoarse': matchMedia("(pointer:coarse)").matches,
                                'hoverNone': matchMedia("(hover:none)").matches,
                                'hasMotion': ("DeviceMotionEvent" in window),
                                'hasOrientation': ("DeviceOrientationEvent" in window),
                                'orientEvent': ("onorientationchange" in window)
                            };
                        let count5 = 0;
                        for (let [key, value] of Object.entries(v29)) {
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
              self2 = this, v30 = $("html"), v31 = $("body");
            $("[data-standalone]").on("scroll", function () {
                 v32 = $(this).scrollTop();
                $(".dashboard-navigation").each(function () {
                     v33 = $(this);
                    if (v33.hasClass("ignore-scroll"))
                        return;
                    (v32 > 0) ? v33.addClass("background[backdrop] scrolled") : v33.removeClass("background[backdrop] scrolled");
                });
            }), $("[data-button=\"additional_details\"]").on("click", function () {
                
                $(this).hasClass("max-height[80px]") ? ($(this).removeClass("max-height[80px]").addClass("max-height[700px]"), $(this).find('i').css("transform", "rotate(-180deg)")) : ($(this).removeClass("max-height[700px]").addClass("max-height[80px]"), $(this).find('i').css("transform", ''));
            }), $("[data-button=\"open_school_id\"]").on("click", function (param32) {
                 
                param32.preventDefault();
                const v34 = $(".school_ids");
                v34.css({
                    'transition': "opacity 220ms ease, transform 220ms ease",
                    'willChange': "opacity, transform",
                    'pointerEvents': "none"
                }), requestAnimationFrame(() => {
                    
                    v34.css({
                        'opacity': 0,
                        'transform': "translateX(0%) translateY(-12px)"
                    });
                }), v34.one("transitionend webkitTransitionEnd", function () {
                    
                    v34.addClass("display-none"), $("[data-standalone]").removeClass("overflow[hidden]").addClass("overflow[y-auto]");
                });
            });
        }
    };
