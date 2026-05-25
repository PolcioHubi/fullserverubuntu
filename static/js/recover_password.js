// Extracted from inline <script> in templates/recover_password_page.html for CSP compliance.
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('recoverPasswordForm');
    if (!form) {
        return;
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const recoveryToken = document.getElementById('recovery_token').value.trim();
        const newPassword = document.getElementById('new_password').value;
        const confirmPassword = document.getElementById('confirm_password').value;

        if (!username || !recoveryToken || !newPassword || !confirmPassword) {
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
            const response = await fetch('/recover_password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    username: username,
                    recovery_token: recoveryToken,
                    new_password: newPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                showAlert(data.message + ' Przekierowywanie do logowania...', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 3000);
            } else {
                showAlert(data.error, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('Wystąpił błąd podczas odzyskiwania hasła. Spróbuj ponownie.', 'error');
        } finally {
            showLoading(false);
        }
    });

    function showAlert(message, type) {
        const alertElement = document.getElementById(type === 'success' ? 'successAlert' : 'errorAlert');
        const otherAlert = document.getElementById(type === 'success' ? 'errorAlert' : 'successAlert');

        otherAlert.style.display = 'none';

        alertElement.textContent = message;
        alertElement.style.display = 'block';

        if (type !== 'success') {
            setTimeout(() => {
                alertElement.style.display = 'none';
            }, 5000);
        }
    }

    function showLoading(show) {
        const loading = document.getElementById('loading');
        const button = document.getElementById('submitBtn');

        if (show) {
            loading.style.display = 'block';
            button.disabled = true;
            button.textContent = 'Odzyskiwanie hasła...';
        } else {
            loading.style.display = 'none';
            button.disabled = false;
            button.textContent = 'Odzyskaj Hasło';
        }
    }
});
