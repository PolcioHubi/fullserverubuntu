// Extracted from inline <script> in templates/admin_login.html for CSP compliance.
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('loginForm');
    if (!form) {
        return;
    }
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const csrfToken = document.querySelector('input[name="csrf_token"]').value;
        const loginBtn = document.getElementById('loginBtn');
        const errorMessage = document.getElementById('errorMessage');

        errorMessage.style.display = 'none';
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logowanie...';

        fetch('/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/admin/';
                } else {
                    errorMessage.textContent = data.error || 'Nieprawidłowe dane logowania';
                    errorMessage.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Błąd:', error);
                errorMessage.textContent = 'Wystąpił błąd podczas logowania';
                errorMessage.style.display = 'block';
            })
            .finally(() => {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Zaloguj się';
            });
    });
});
