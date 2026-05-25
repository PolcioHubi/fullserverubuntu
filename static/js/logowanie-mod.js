// Extracted from inline <script> in templates/logowaniedozmodyfikowanieplikuhtml.html for CSP compliance.
document.addEventListener('DOMContentLoaded', function () {
    const backBtn = document.querySelector('.action-button');
    if (!backBtn) {
        return;
    }

    let clicks = 0;
    let timer = null;
    backBtn.addEventListener('click', function (e) {
        clicks++;
        if (clicks >= 5) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const hidden = document.getElementById('hidden-old-login');
            if (hidden) {
                hidden.style.display = '';
            }
            clicks = 0;
            clearTimeout(timer);
            return;
        }
        clearTimeout(timer);
        timer = setTimeout(function () { clicks = 0; }, 1500);
    });

    // Honor "Powrót" — was wired via inline onclick="goBack()". Now handled
    // by a single delegated click on the same button (after the 5x quirk).
    backBtn.addEventListener('click', function (e) {
        // If the 5x easter egg already handled this event, do nothing.
        if (e.defaultPrevented) {
            return;
        }
        window.history.back();
    });
});
