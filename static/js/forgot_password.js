// Extracted from inline <script> in templates/forgot_password_page.html for CSP compliance.
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('forgotPasswordForm');
    if (!form) {
        return;
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();

        if (!username) {
            showAlert('Nazwa użytkownika jest wymagana', 'error');
            return;
        }

        showLoading(true);

        try {
            const response = await fetch('/forgot_password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('input[name="csrf_token"]').value
                },
                body: JSON.stringify({
                    username: username
                })
            });

            const data = await response.json();

            if (data.success) {
                showAlert(data.message, 'success');
            } else {
                showAlert(data.error, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('Wystąpił błąd podczas wysyłania żądania. Spróbuj ponownie.', 'error');
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
            button.textContent = 'Wysyłanie...';
        } else {
            loading.style.display = 'none';
            button.disabled = false;
            button.textContent = 'Wyślij link do resetowania';
        }
    }
});
