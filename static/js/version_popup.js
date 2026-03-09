(function() {
    'use strict';

    var overlay = document.createElement('div');
    overlay.id = 'version-popup-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:16px;padding:32px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

    var icon = document.createElement('div');
    icon.style.cssText = 'font-size:48px;margin-bottom:16px;';
    icon.textContent = '\u26A0\uFE0F';

    var title = document.createElement('h2');
    title.style.cssText = 'margin:0 0 12px;font-size:20px;color:#1a1a1a;font-weight:700;';
    title.textContent = 'Dost\u0119pna nowa wersja!';

    var msg = document.createElement('p');
    msg.style.cssText = 'margin:0 0 24px;font-size:15px;color:#444;line-height:1.5;';
    msg.textContent = 'Ta wersja aplikacji mObywatel jest nieaktualna. Odinstaluj j\u0105 i zainstaluj now\u0105 wersj\u0119, aby korzysta\u0107 z najnowszych funkcji i bezpiecze\u0144stwa.';

    var steps = document.createElement('div');
    steps.style.cssText = 'background:#f5f6fb;border-radius:12px;padding:16px;margin-bottom:24px;text-align:left;font-size:14px;color:#333;line-height:1.6;';
    steps.innerHTML = '<strong>Jak zaktualizowa\u0107:</strong><br>1. Odinstaluj t\u0119 aplikacj\u0119<br>2. Wejd\u017A na <b>now\u0105 stron\u0119</b><br>3. Zarejestruj si\u0119 i uzupe\u0142nij dane';

    var btn = document.createElement('a');
    btn.href = '/';
    btn.style.cssText = 'display:inline-block;background:#0052cc;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:16px;font-weight:600;transition:background 0.2s;';
    btn.textContent = 'Przejd\u017A do nowej wersji \u2192';
    btn.onmouseover = function() { btn.style.background = '#003d99'; };
    btn.onmouseout = function() { btn.style.background = '#0052cc'; };

    box.appendChild(icon);
    box.appendChild(title);
    box.appendChild(msg);
    box.appendChild(steps);
    box.appendChild(btn);
    overlay.appendChild(box);

    if (document.body) {
        document.body.appendChild(overlay);
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            document.body.appendChild(overlay);
        });
    }
})();
