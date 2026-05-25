// Handler for templates/reset_password_page.html — submits token + new password
// to POST /reset_password. CSP-compliant: no inline script, no inline handlers.
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('resetPasswordForm');
    if (!form) {
        return;
    }

    // Pre-fill token from ?token=... query parameter so an emailed link can
    // open the page with the token already in the field.
    try {
        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = params.get('token');
        const tokenInput = document.getElementById('token');
        if (tokenFromUrl && tokenInput && !tokenInput.value) {
            tokenInput.value = tokenFromUrl;
        }
    } catch (_) {
        // No-op — older browsers or unusual URL shapes.
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const token = document.getElementById('token').value.trim();
        const newPassword = document.getElementById('new_password').value;
        const confirmPassword = document.getElementById('confirm_password').value;

        if (!token || !newPassword || !confirmPassword) {
            showAlert('Wszystkie pola są wymagane', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            showAlert('Hasła nie są zgodne', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showAlert('Hasło musi mieć co najmniej 6 znaków', 'error');
            return;
        }

        showLoading(true);
        const csrfToken = document.querySelector('input[name="csrf_token"]').value;

        try {
            const response = await fetch('/reset_password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    token: token,
                    new_password: newPassword
                })
            });
            const data = await response.json();
            if (data.success) {
                showAlert((data.message || 'Hasło zmienione.') + ' Przekierowywanie do logowania...', 'success');
                setTimeout(() => { window.location.href = '/login'; }, 3000);
            } else {
                showAlert(data.error || 'Nie udało się zresetować hasła.', 'error');
            }
        } catch (err) {
            console.error('Error:', err);
            showAlert('Wystąpił błąd podczas resetowania hasła. Spróbuj ponownie.', 'error');
        } finally {
            showLoading(false);
        }
    });

    function showAlert(message, type) {
        const target = document.getElementById(type === 'success' ? 'successAlert' : 'errorAlert');
        const other = document.getElementById(type === 'success' ? 'errorAlert' : 'successAlert');
        other.style.display = 'none';
        target.textContent = message;
        target.style.display = 'block';
        if (type !== 'success') {
            setTimeout(() => { target.style.display = 'none'; }, 5000);
        }
    }

    function showLoading(show) {
        const loading = document.getElementById('loading');
        const button = document.getElementById('submitBtn');
        if (show) {
            loading.style.display = 'block';
            button.disabled = true;
            button.textContent = 'Resetowanie...';
        } else {
            loading.style.display = 'none';
            button.disabled = false;
            button.textContent = 'Zresetuj hasło';
        }
    }
});
