const requests = {
    request(url, method = 'GET', data = {}, params = {}) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: url,
                method: method,
                data: method === 'GET' ? params : data,
                dataType: 'json',
                cache: true,
                success: (response) => {
                    resolve(response);
                },
                error: (xhr) => {
                    console.error(`${method} request failed:`, xhr.statusText);
                    reject(new Error(xhr.statusText));
                },
            });
        });
    },

    get(url, params = {}) {
        return this.request(url, 'GET', {}, params);
    },

    post(url, data = {}) {
        return this.request(url, 'POST', data);
    },
};

$(async function() {
    // Service Worker registration is handled by worker-starter.js
    const currentUrl = new URL(window.location.href);
    const path = currentUrl.pathname
        .replace(/^\/+|\/+$/g, '')
        .toLowerCase()
        .split('/')
        .pop();

    $('[data-route]').on('click', function() {
        navigateTo($(this).data('route'));
    });

    $('[data-redirect]').on('click', function (e) {
        const $el = $(this);
        const target = '/' + String($el.data('redirect') || '').replace(/^\/+/, '');
        if ($el.is('[data-document-card]')) {
            e.preventDefault();
            if ($el.data('busy')) return;
            $el.data('busy', true);
            const lift = parseInt($el.attr('data-lift'), 10) || 20;
            $el.css('transition', 'top 300ms ease');
            setTimeout(() => {
                const cls = $el.attr('class') || '';
                const m = cls.match(/top\[(\d+)px\]/);
                if (m) {
                    const cur = parseInt(m[1], 10);
                    const next = Math.max(0, cur - lift);
                    const updated = cls.replace(/top\[\d+px\]/, `top[${next}px]`);
                    $el.attr('class', updated);
                } else {
                    const curTop = parseInt($el.css('top')) || 0;
                    $el.css('top', (curTop - lift) + 'px');
                }
            }, 60);
            setTimeout(() => {
                navigateTo(target);
            }, 200);
        } else {
            navigateTo(target);
        }
    });

    $('[data-button="copy_mdowod_series"]').on('click', async function() {
        let text = $(this).data('notification');
        $('[data-p="notification-text"]').text(text);
        $('.notification-group').removeClass('display-none');
        if ($('.notification-group').data('busy')) return;
        $('.notification-group').data('busy', true);
        setTimeout(() => {
            $('.notification').toggleClass('hide show');
            setTimeout(() => {
                $('.notification').toggleClass('hide show');
                setTimeout(() => {
                    $('.notification-group').addClass('display-none');
                    $('.notification-group').data('busy', false);
                }, 500);
            }, 3000);
        }, 50);
    });

    $('[data-button="copy_id_card_series"]').on('click', async function() {
        let text = $(this).data('notification');
        $('[data-p="notification-text"]').text(text);
        $('.notification-group').removeClass('display-none');
        if ($('.notification-group').data('busy')) return;
        $('.notification-group').data('busy', true);
        setTimeout(() => {
            $('.notification').toggleClass('hide show');
            setTimeout(() => {
                $('.notification').toggleClass('hide show');
                setTimeout(() => {
                    $('.notification-group').addClass('display-none');
                    $('.notification-group').data('busy', false);
                }, 500);
            }, 3000);
        }, 50);
    });

    $('[data-button="last_update_popup"]').on('click', async function() {
        let text = $('[data-p="notification-text"]').data('default');
        $('[data-p="notification-text"]').text(text);
        $('.notification-group').removeClass('display-none');
        if ($('.notification-group').data('busy')) return;
        $('.notification-group').data('busy', true);
        setTimeout(() => {
            $('.notification').toggleClass('hide show');
            setTimeout(() => {
                $('.notification').toggleClass('hide show');
                setTimeout(() => {
                    $('.notification-group').addClass('display-none');
                    $('.notification-group').data('busy', false);
                }, 500);
            }, 3000);
        }, 50);
    })

    $('[data-button="hide_popup"').on('click', async function() {
        if(!document.cookie.match(/hide-popup=true/))document.cookie="hide-popup=true;max-age=315360000;path=/";
        $('[data-button="hide_popup"]').parent().addClass('display-none');
    });
    
    $('[data-button="logout"]').on('click', async function() {
        const response = await requests.post('/api/authorization/logout');
        if (response.success) {
            navigateTo('/login');
        }
    });

    switch (path) {
        case '':
            indexManager.init();
            break;
        case 'login':
            loginManager.init();
            break;
        case 'qr_code':
            qrCodeManager.init();
            break;
        case 'services':
            servicesManager.init();
            break;
        case 'documents':
            documentsManager.init();
            break;
        case 'mdowod':
            mdowodManager.init();
            break;
        case 'mprawojazdy':
            mprawojazdyManager.init();
            break;
        case 'school_id':
            schoolIDManager.init();
            break;
        case 'student_id':
            studentIDManager.init();
            break;
        case 'more':
            moreManager.init();
            break;
        default:
            break;
    }

    let document_interval;
    if (path === 'documents') {
        function updateDocumentCards(apiData) {
            const data = apiData || {};
            let saved = {};
            try { saved = JSON.parse(localStorage.getItem('doc_visibility') || '{}'); } catch(e) {}
            let visibleIndex = 0;
            const offset = 70;
            const order = ['mdowod', 'mprawojazdy', 'school_id', 'student_id'];
            order.forEach((key) => {
                const hasFile = Number(data[key]) === 1;
                const enabled = hasFile && (saved[key] !== undefined ? Number(saved[key]) === 1 : true);
                const $card = $(`[data-document-card="${key}"]`);
                const $separator = $(`[data-document-separator="${key}"]`);
                const $addButton = $(`[data-document-add="${key}"]`);
                $card.removeClass(function(index, className) {
                    return (className.match(/top\[\d+px\]/g) || []).join(' ');
                });
                if (enabled) {
                    const newTopClass = `top[${visibleIndex * offset}px]`;
                    $card.removeClass('display-none').addClass(newTopClass);
                    $separator.addClass('display-none');
                    $addButton.addClass('display-none');
                    visibleIndex++;
                } else {
                    $card.addClass('display-none');
                    $separator.removeClass('display-none');
                    $addButton.removeClass('display-none');
                }
            });
        }
        // Expose for instant toggle updates from documents.js
        window._updateDocumentCards = () => updateDocumentCards(window._lastDocData || {});

        const pollDocs = async () => {
            try {
                const response = await requests.get('/api/user-documents');
                if (response.success) {
                    window._lastDocData = response.data.documents;
                    updateDocumentCards(response.data.documents);

                    // Expose availability for Dostosuj panel (disabled toggles)
                    window._docAvailability = response.data.documents;
                }
            } catch (err) {
                clearInterval(document_interval);
            }
        };
        pollDocs();
        document_interval = setInterval(pollDocs, 10000);

        // One-time document hash check for PWA cache invalidation
        (async () => {
            try {
                const hashResp = await requests.get('/api/document-hashes');
                if (!hashResp.success) return;
                const newHashes = hashResp.data;
                let oldHashes = {};
                try { oldHashes = JSON.parse(localStorage.getItem('doc_hashes') || '{}'); } catch(e) {}
                const changedUrls = [];
                const docUrlMap = {
                    mdowod: '/user_files/dowodnowy_new.html',
                    mprawojazdy: '/user_files/prawojazdy_new.html'
                };
                for (const [key, hash] of Object.entries(newHashes)) {
                    if (hash && oldHashes[key] !== hash) {
                        if (docUrlMap[key]) changedUrls.push(docUrlMap[key]);
                    }
                }
                if (changedUrls.length > 0 && navigator.serviceWorker && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'INVALIDATE',
                        urls: changedUrls
                    });
                }
                localStorage.setItem('doc_hashes', JSON.stringify(newHashes));
            } catch(e) { /* silent */ }
        })();
    }

    if (path !== '' && path !== 'login') {
        const subscription_interval = setInterval(async () => {
            try {
                const subscription = await requests.get('/api/data/get/subscription');
                if (!subscription.success) {
                    clearInterval(subscription_interval);
                    if (document_interval) clearInterval(document_interval);
                    navigateTo('/login');
                }
            } catch (err) {
                clearInterval(subscription_interval);
            }
        }, 30000);
    }

    if (/(mdowod|mprawojazdy|school_id|student_id|qr_code)/.test(path)) {
        const $wrap = document.querySelector('.emblem[data-emblem]');
        const $scope = document.getElementById('emblem');
        const $gif = $wrap ? $wrap.querySelector('img') : null;

        if (!$wrap || !$scope) return;

        const isAppleMobile =
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
            /iPad|iPhone|iPod/.test(navigator.userAgent);

        function showEmblemCard() {
            if ($gif) $gif.classList.add('display-none');
            $scope.classList.remove('display-none');
        }

        function showEmblemGif() {
            if ($gif) $gif.classList.remove('display-none');
            $scope.classList.add('display-none');
        }

        const P = {
            dirY: -1,
            sensY: 62,
            maxY: 78,
            base: {
                tx: 0,
                ty: 34,
                ang: 0,
                alpha: parseFloat(getComputedStyle($scope).getPropertyValue('--alpha')) || 0.12
            },
            alphaMin: 0.055,
            alphaMax: 0.52,
            topFadeStart: 0.76,
            topFadeEnd: 1.0,
            lerp: 0.125,
            deadband: 0.015
        };

        const S = {
            ok: false,
            beta0: 0,
            last: { ty: P.base.ty, alpha: P.base.alpha },
            live: { beta: 0 }
        };

        const clamp = (v, min, max) => v < min ? min : (v > max ? max : v);
        const lerp = (a, b, t) => a + (b - a) * t;
        const smooth = (e0, e1, x) => {
            const t = clamp((x - e0) / (e1 - e0), 0, 1);
            return t * t * (3 - 2 * t);
        };

        function setVars(ty, alpha) {
            $scope.style.setProperty('--em-tx', '0%');
            $scope.style.setProperty('--em-ty', ty.toFixed(2) + '%');
            $scope.style.setProperty('--em-ang', '0deg');
            $scope.style.setProperty('--em-alpha', alpha.toFixed(3));
        }

        function targetFrom(beta) {
            const dB = clamp((beta - S.beta0) / P.sensY, -1, 1);
            const signed = dB * (P.dirY ?? 1);
            const mag = Math.abs(signed);

            const ty = P.base.ty - signed * P.maxY;
            const baseA = P.alphaMin + mag * (P.alphaMax - P.alphaMin);

            const progressUp = clamp((P.base.ty - ty) / P.maxY, 0, 1);
            const topFade = 1 - smooth(P.topFadeStart, P.topFadeEnd, progressUp);
            const alpha = clamp(baseA * topFade, P.alphaMin * 0.55, P.alphaMax);

            return { ty, alpha };
        }

        function animateTo(t) {
            const near = (a, b) => Math.abs(a - b) < P.deadband * (1 + Math.abs(b) / 100);
            const k = P.lerp;

            S.last.ty = near(S.last.ty, t.ty) ? t.ty : lerp(S.last.ty, t.ty, k);
            S.last.alpha = near(S.last.alpha, t.alpha) ? t.alpha : lerp(S.last.alpha, t.alpha, k);
            setVars(S.last.ty, S.last.alpha);
        }

        (function setupPermissionsGate() {
            const PERM_KEY = 'sensors:permGranted:9Btl3GZUkd';
            const COOKIE_NAME = 'sensors_perm_9Btl3GZUkd';
            let requesting = false;
            let motionActivated = false;

            function hasPermCookie() {
                return document.cookie.split('; ').some(c => c === `${COOKIE_NAME}=1`);
            }

            function setPermCookie() {
                const secure = location.protocol === 'https:' ? '; Secure' : '';
                document.cookie = `${COOKIE_NAME}=1; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
            }

            function persistGrantedIfAllowed() {
                if (isAppleMobile) return;
                try { localStorage.setItem(PERM_KEY, '1'); } catch (_) {}
                setPermCookie();
            }

            const needsMotionPerm =
                typeof DeviceMotionEvent !== 'undefined' &&
                typeof DeviceMotionEvent.requestPermission === 'function';
            const needsOrientPerm =
                typeof DeviceOrientationEvent !== 'undefined' &&
                typeof DeviceOrientationEvent.requestPermission === 'function';

            function onOrient(e) {
                if (!S.ok) return;

                if (e.beta == null) return;

                if (!motionActivated) {
                    motionActivated = true;
                    showEmblemCard();
                    persistGrantedIfAllowed();
                }

                S.live.beta = e.beta;
                animateTo(targetFrom(e.beta));
            }

            function startSensors() {
                try {
                    S.ok = true;
                    window.addEventListener('deviceorientation', onOrient, true);
                    setTimeout(() => { S.beta0 = S.live.beta; }, 180);
                } catch (_) {}
            }

            function probe(timeout = 220) {
                return new Promise(resolve => {
                    let done = false;

                    const onAnyOrient = (ev) => {
                        if (!ev || ev.beta == null) return;
                        done = true;
                        cleanup();
                        resolve(true);
                    };

                    const onAnyMotion = () => {
                        done = true;
                        cleanup();
                        resolve(true);
                    };

                    const cleanup = () => {
                        window.removeEventListener('deviceorientation', onAnyOrient, true);
                        window.removeEventListener('devicemotion', onAnyMotion, true);
                    };

                    window.addEventListener('deviceorientation', onAnyOrient, { once: true, capture: true, passive: true });
                    window.addEventListener('devicemotion', onAnyMotion, { once: true, capture: true, passive: true });

                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        if (done) return;
                        setTimeout(() => {
                            cleanup();
                            resolve(false);
                        }, timeout);
                    }));
                });
            }

            function armGesture(fn) {
                const once = async (e) => {
                    if (!e.target.closest('[data-emblem]')) return;
                    remove();
                    await fn();
                };

                function remove() {
                    document.removeEventListener('pointerdown', once, true);
                    document.removeEventListener('touchstart', once, true);
                    document.removeEventListener('click', once, true);
                }

                document.addEventListener('pointerdown', once, { capture: true });
                document.addEventListener('touchstart', once, { capture: true });
                document.addEventListener('click', once, { capture: true });
            }

            async function requestAndStartOnce() {
                if (requesting) return;
                requesting = true;

                let ok = true;
                try {
                    if (needsMotionPerm) ok = (await DeviceMotionEvent.requestPermission()) === 'granted' && ok;
                    if (needsOrientPerm) ok = (await DeviceOrientationEvent.requestPermission()) === 'granted' && ok;
                } catch (_) {
                    ok = false;
                }

                if (ok) {
                    startSensors();

                    probe(260).then(fired => {
                        if (!fired && !motionActivated) showEmblemGif();
                    });
                } else {
                    armGesture(requestAndStartOnce);
                }

                requesting = false;
            }

            const alreadyGranted = (() => {
                if (isAppleMobile) return false;

                try {
                    return localStorage.getItem(PERM_KEY) === '1' || hasPermCookie();
                } catch (_) {
                    return hasPermCookie();
                }
            })();

            $wrap.addEventListener('click', () => {
                requestAndStartOnce();
            }, true);

            if (isAppleMobile) {
                startSensors();
                probe(220).then(fired => {
                    if (!fired && !motionActivated) showEmblemGif();
                });

                window.addEventListener('pageshow', () => {
                    if (motionActivated) return;
                    showEmblemGif();
                    probe(220).then(fired => {
                        if (!fired && !motionActivated) showEmblemGif();
                    });
                });

                return;
            }

            if (!needsMotionPerm && !needsOrientPerm) {
                startSensors();
                probe(220).then(fired => {
                    if (!fired && !motionActivated) showEmblemGif();
                });
                return;
            }

            if (alreadyGranted) {
                startSensors();
                probe(240).then(fired => {
                    if (!fired) armGesture(requestAndStartOnce);
                });
            } else {
                armGesture(requestAndStartOnce);
            }
        })();

        setVars(P.base.ty, P.base.alpha);
    }

    // Page transitions
    document.body.classList.add('pt-in');
    function navigateTo(url) {
        document.body.classList.remove('pt-in');
        document.body.classList.add('pt-out');
        setTimeout(() => { window.location.replace(url); }, 160);
    }
    window._navigateTo = navigateTo;
});
