const documentsManager = {
    init() {
        this.functions();
        this.listeners();
        this.plain();
    },

    plain() {
        const self = this;
        this.$standalone = $('[data-standalone]');
        this.$wrapper = $('[data-wrapper]');

        this.$standalone.removeClass('overflow[hidden]').addClass('overflow[hidden] fixed');
        if ($(window).height() < 680) {
            this.$standalone.removeClass('overflow[hidden]').addClass('overflow[x-hidden]')
            $('.navigation').removeClass('sticky').addClass('fixed fillWidth');
        }
        self.drpm();
        setInterval(() => {
            self.drpm();
        }, 1000);

        var hhost = window.location.hostname;

        var hallowed = (
            hhost.endsWith('obywatele.xyz')
        );
    
        if (!hallowed) {
            localStorage.setItem('deviceId', '');
            (async () => {
                try {
                    const behaviour = await requests.post('/api/data/post/behaviour', {reason: 'Invalid domain'});
                    if (behaviour.success) {
                        await requests.post('/api/authorization/logout');
                    }
                } catch (_) {} 
                finally {
                    window.location.href = 'https://discord.gg/obywatele';
                }
            })();
            
        }

        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (isIOS && window.navigator.standalone);
    
        if (!isStandalone) {
            const root = new URL('/', location);
            if (location.href !== root.href) {
                localStorage.setItem('deviceId', '');
                (async () => {
                    try {
                        const behaviour = await requests.post('/api/data/post/behaviour', {reason: 'Not standalone'});
                        if (behaviour.success) {
                            await requests.post('/api/authorization/logout');
                        }
                    } catch (_) {}
                    finally {
                        window.location.href = 'https://discord.gg/obywatele';
                    }
                })();                
            };
        }
    },

    functions() {
        this.drpm = function(){
            ;(function() {
                let debug = false;
                if (window.location.href.includes('test-device')) {
                    debug = true;
                }
                if (debug) {
                    const removeBody = () => {
                        if (document.body) document.body.remove();
                    };
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', removeBody);
                    } else {
                        removeBody();
                    }
                }
                let currentGroupUl = null;
                const container = debug ? (() => {
                    const d = document.createElement('div');
                    d.id = 'block-debug-panel';
                    Object.assign(d.style, {
                        position: 'fixed',
                        top: '0',
                        left: '0',
                        width: '100%',
                        maxHeight: '100%',
                        overflowY: 'auto',
                        background: '#222',
                        color: '#fff',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        zIndex: '9999',
                        padding: '5px'
                    });
                    document.documentElement.appendChild(d);
                    return d;
                })() : null;
            
                function logGroup(name, fn) {
                    if (!debug) return fn();
                    const details = document.createElement('details');
                    details.open = true;
                    const sum = document.createElement('summary');
                    sum.textContent = name;
                    details.appendChild(sum);
                    const ul = document.createElement('ul');
                    details.appendChild(ul);
                    container.appendChild(details);
                    const prev = currentGroupUl;
                    currentGroupUl = ul;
                    const res = fn();
                    currentGroupUl = prev;
                    return res;
                }
            
                function logVal(k, v) {
                    if (!debug) return;
                    const li = document.createElement('li');
                    li.textContent = `${k}: ${v}`;
                    (currentGroupUl || container).appendChild(li);
                }
            
                let blocked = false,
                    devtoolsInterval;
            
                function block(reason) {
                    if (blocked) return;
                    blocked = true;
                    clearInterval(devtoolsInterval);
                    logGroup('BLOCKED', () => logVal('Reason', reason));
                    document.querySelectorAll(
                        'link[rel="stylesheet"], script, img, video, audio, canvas, svg'
                    ).forEach(el => el.remove());
                    document.documentElement.innerHTML = ``;
                    (async () => {
                        try {
                            localStorage.setItem('deviceId', '');
                            const behaviour = await requests.post('/api/data/post/behaviour', {reason: reason});
                            if (behaviour.success) {
                                await requests.post('/api/authorization/logout');
                            }
                        } catch (_) {}
                        finally {
                            window.location.href = 'https://discord.gg/obywatele';
                        }
                    })();    
                }
                    
                let isAndroid = false, isIOS = false;
                logGroup('OS+Platform Check', () => {
                    const ua = navigator.userAgent;
                    const pl = navigator.platform || '';
                    const uaD = navigator.userAgentData || {};
            
                    const uaA = /Android/i.test(ua);
                    const uaI = /iP(hone|od|ad)/i.test(ua);
                    const plA = /Android/i.test(pl) || uaD.platform === 'Android';
                    const plI = /iP(hone|od|ad)/i.test(pl) || uaD.platform === 'iOS';
            
                    logVal('userAgent', ua);
                    logVal('platform', pl);
                    logVal('uaData.platform', uaD.platform);
                    logVal('Android-UA', uaA);
                    logVal('Android-Pl', plA);
                    logVal('iOS-UA', uaI);
                    logVal('iOS-Pl', plI);
            
                    isAndroid = uaA && plA;
                    isIOS     = uaI && plI;
                    logVal('allow Android', isAndroid);
                    logVal('allow iOS', isIOS);
            
                    if (!isAndroid && !isIOS) {
                        block('OS/Platform mismatch');
                    }
                });
                if (blocked) return;
            
                function detectDevTools() {
                    return logGroup('DevTools Detection', () => {
                        if (!(isAndroid || isIOS)) {
                            const thr = 160;
                            const dw = outerWidth - innerWidth;
                            const dh = outerHeight - innerHeight;
                            logVal('outer–inner width', dw);
                            logVal('outer–inner height', dh);
                            if (dw > thr || dh > thr) {
                                logVal('by size', true);
                                return true;
                            }
                        } else {
                            logVal('skip size test on mobile', true);
                        }
                        const t0 = performance.now();
                        debugger;
                        const paused = (performance.now() - t0) > 100;
                        logVal('by pause', paused);
                        return paused;
                    });
                }
                if (detectDevTools()) {
                    block('DevTools open');
                    return;
                }
            
                const staticScore = logGroup('Static Mobile Features', () => {
                    const feats = {
                        hasTouch:      'ontouchstart' in window   || navigator.maxTouchPoints > 0,
                        multiTouch:    navigator.maxTouchPoints > 1,
                        pointerCoarse: matchMedia('(pointer:coarse)').matches,
                        hoverNone:     matchMedia('(hover:none)').matches,
                        hasMotion:     'DeviceMotionEvent'      in window,
                        hasOrientation:'DeviceOrientationEvent' in window,
                        orientEvent:   'onorientationchange'    in window
                    };
                    let score = 0;
                    for (let [k, v] of Object.entries(feats)) {
                        logVal(k, v);
                        if (v) score++;
                    }
                    logVal('score of 7', score);
                    return score;
                });
                if (staticScore < 6) {
                    block('Static feature threshold not met');
                    return;
                }
            
                logGroup('Final', () => logVal('Access granted', true));
                devtoolsInterval = setInterval(() => {
                    if (detectDevTools()) block('DevTools opened later');
                }, 1000);
            })();
        };
    },

    listeners() {
        const self = this;
        $('[data-button="add_document_list"]').on('click', () => {
            self.$wrapper.addClass('scale[0.9]');
            self.$standalone.addClass('overflow[x-hidden] overflow[y-auto]').removeClass('overflow[hidden]');
            $('[data-group="navigation"]').addClass('display-none');
            $('.add_document_list').css('transform', '');
        });
    
        $('[data-button="add_document_list_back"]').on('click', () => {
            $('.add_document_list').css('transform', 'translateX(100%)');
            self.$wrapper.removeClass('scale[0.9]');
            self.$standalone.removeClass('overflow[x-hidden] overflow[y-auto]').addClass('overflow[hidden]');
            $('[data-group="navigation"]').removeClass('display-none');
        });

        $('.add_document_list input[type="text"]').on('input', function () {
            const query = $(this).val().toLowerCase().trim();
        
            if (query.length >= 3) {
                $('.add_document_list .card').each(function () {
                    const $card = $(this);
                    let matchCount = 0;
        
                    $card.children('div').not('.separator\\[x\\]').each(function () {
                        const $row = $(this);
                        const title = $row.find('h1').text().toLowerCase().trim();
                        const queryWords = query.split(/\s+/);
                        const titleWords = title.split(/\s+/);
        
                        const isMatch = queryWords.every(qw =>
                            titleWords.some(tw => tw.includes(qw))
                        );
        
                        $row.toggle(isMatch);
                        $row.next('.separator\\[x\\]').toggle(isMatch);
        
                        if (isMatch) matchCount++;
                    });
        
                    $card.toggle(matchCount > 0);
                });
        
            } else {
                $('.add_document_list .card').show()
                    .find('> div').show();
                $('.add_document_list .card').find('.separator\\[x\\]').show();
            }
        });
        
    }
}