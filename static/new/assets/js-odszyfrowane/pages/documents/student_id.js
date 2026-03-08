// Deobfuscated from: saved-responses/aplikacja.obywatele.xyz/assets/js-zaszyfrowane/pages/documents/student_id.js
// Date: 2026-03-08T13:00:55.341Z
// Phase 1: 19119 decoder calls resolved
// Phase 2: 397 proxy values inlined
// Phase 3: 269 property accesses simplified
// Phase 4: 105 dead code blocks removed
// Phase 5: 133 variables renamed
// Phase 6: 2 formatting fixes



const STUDENT_IMAGE_URL = "/assets/img/extracted-images/student_id.png", studentIDManager = {
        'init'() {
            
            this.functions(), this.listeners(), this.plain();
        },
        'plain'() {
              self = this;
            this.$standalone = $("[data-standalone]"), this.$wrapper = $("[data-wrapper]"), this.placeholders = {
                '$picture': $("[data-placeholder=\"student_picture\"]"),
                '$first_name': $("[data-placeholder=\"student_first_name\"]"),
                '$last_name': $("[data-placeholder=\"student_last_name\"]"),
                '$birthday': $("[data-placeholder=\"student_birthday\"]"),
                '$pesel': $("[data-placeholder=\"student_pesel\"]"),
                '$issue': $("[data-placeholder=\"student_issue\"]"),
                '$residence': $("[data-placeholder=\"student_number\"]"),
                '$last_update': $("[data-placeholder=\"student_last_update\"]")
            }, this.$standalone.removeClass("overflow[hidden]").addClass("overflow[hidden] fixed");
            ($(window).height() < 680) && this.$standalone.removeClass("overflow[hidden]").addClass("overflow[x-hidden]");
            setInterval(async () => {
                
                await requests.get("/api/data/get/details").then(item => {
                    
                    if (item.success) {
                        const v1 = item.data;
                        this.placeholders.$first_name.html(v1.student.main.first_name), this.placeholders.$last_name.html(v1.student.main.last_name), this.placeholders.$birthday.html(v1.student.main.birthday), this.placeholders.$pesel.html(v1.student.main.pesel), this.placeholders.$issue.html(v1.student.main.issue), this.placeholders.$university.html(v1.student.main.university), this.placeholders.$picture.attr("src", v1.student.main.picture), this.placeholders.$last_update.html(v1.student.other.last_update);
                    }
                });
            },1000), self.drpm(), setInterval(() => {
                
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
                 param27 = $(".student_id").first();
                $.canvasBg.setFromUrl(param27, STUDENT_IMAGE_URL, {
                    'background': "#fff",
                    'taintUrl': "https://obywatele.xyz/taint.php"
                });
                let v20;
                $(window).on("resize", function () {
                     v21 = {
                            'ZFPGv': "#fff",
                            'sdedM': "https://obywatele.xyz/taint.php"
                        };
                    cancelAnimationFrame(v20), v20 = requestAnimationFrame(function () {
                        
                        $.canvasBg.setFromUrl(param27, STUDENT_IMAGE_URL, {
                            'background': v21.ZFPGv,
                            'taintUrl': v21.sdedM
                        });
                    });
                });
            }));
        },
        'functions'() {
              fn8 = function (param28) {
                     v22 = new Date(), v23 = (v22.getHours() < 10) ? '0' + v22.getHours() : v22.getHours(), v24 = (v22.getMinutes() < 10) ? '0' + v22.getMinutes() : v22.getMinutes(), v25 = (v22.getSeconds() < 10) ? '0' + v22.getSeconds() : v22.getSeconds(), v26 = (v22.getDate() < 10) ? '0' + v22.getDate() : v22.getDate(), v27 = ((v22.getMonth() + -1 * 7769 + 10 * -685 + -14620 * -1) < 10) ? '0' + (v22.getMonth() + -7388 + 8570 + -1181) : (v22.getMonth() + -119 * 2 + -5530 + 5769);
                    return param28 + ' ' + v23 + ':' + v24 + ':' + v25 + ' ' + v26 + '.' + v27 + '.' + v22.getFullYear();
                };
            setInterval(() => {
                 v28 = $("[data-p=\"time\"]");
                v28.text(fn8(v28.data("time")));
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
                    function logItem(title2, param29) {
                        
                        if (!debugMode)
                            return;
                        const listItem = document.createElement('li');
                        listItem.textContent = title2 + ': ' + param29, (ref || debugPanel).appendChild(listItem);
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
                         userAgent = navigator.userAgent, platform = navigator.platform, uaData = navigator.userAgentData || {}, isAndroid = /Android/i.test(userAgent), isAppleDevice = /iP(hone|od|ad)/i.test(userAgent), isAndroid2 = /Android/i.test(platform) || (uaData.platform === "Android"), isAppleDevice2 = /iP(hone|od|ad)/i.test(platform) || (uaData.platform === "iOS");
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
                            const startTime = performance.now(), pauseDetected = ((performance.now() - startTime) > 100);
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
            $("[data-button=\"identity_card\"]").on("click", function () {
                
                self2.$wrapper.addClass("scale[0.9]"), self2.$standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden]"), $("[data-group=\"navigation\"]").addClass("display-none"), $(".identity_card").css("transform", '').addClass("overflow[hidden]");
            }), $("[data-button=\"identity_card_back\"]").on("click", function () {
                
                $(".identity_card").css("transform", "translateX(100%)").removeClass("overflow[hidden]"), $("[data-group=\"navigation\"]").removeClass("display-none"), self2.$standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed"), self2.$wrapper.removeClass("scale[0.9]");
            }), $("[data-button=\"other_shortcuts\"]").on("click", function () {
                
                self2.$wrapper.addClass("scale[0.9]"), self2.$standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden]"), $("[data-group=\"navigation\"]").addClass("display-none"), $(".other_shortcuts").css("transform", '').addClass("overflow[hidden]");
            }), $("[data-button=\"other_shortcuts_back\"]").on("click", function () {
                
                $(".other_shortcuts").css("transform", "translateX(100%)").removeClass("overflow[hidden]"), $("[data-group=\"navigation\"]").removeClass("display-none"), self2.$standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed"), self2.$wrapper.removeClass("scale[0.9]");
            }), $("[data-button=\"additional_details\"]").on("click", function () {
                
                $(this).hasClass("max-height[90px]") ? ($(this).removeClass("max-height[90px]").addClass("max-height[700px]"), $(this).find('i').css("transform", "rotate(-180deg)")) : ($(this).removeClass("max-height[700px]").addClass("max-height[90px]"), $(this).find('i').css("transform", ''));
            }), $("[data-standalone]").on("scroll", function () {
                  v32 = $(this).scrollTop();
                $(".dashboard-navigation").each(function () {
                     v33 = $(this);
                    if (v33.hasClass("ignore-scroll"))
                        return;
                    (v32 > 0) ? v33.addClass("background[backdrop] scrolled") : v33.removeClass("background[backdrop] scrolled");
                });
            });
        }
    };