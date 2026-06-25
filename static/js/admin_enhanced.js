// Extracted from inline <script> in templates/admin_enhanced.html for CSP compliance.
// Globalne dane
let currentData = {
    stats: {},
    accessKeys: [],
    registeredUsers: [],
    fileUsers: []
};
const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Funkcje nawigacji
function showTab(tabName, tabButton) {
    // Ukryj wszystkie taby
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Pokaż wybrany tab
    document.getElementById(tabName).classList.add('active');
    const selectedTab = tabButton || Array.from(document.querySelectorAll('.tab'))
        .find(tab => tab.getAttribute('data-arg-0') === tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
}

// Funkcje alertów
function showAlert(message, type = 'success') {
    const alertElement = document.getElementById(type === 'success' ? 'alertSuccess' : 'alertError');
    alertElement.textContent = message;
    alertElement.style.display = 'block';

    setTimeout(() => {
        alertElement.style.display = 'none';
    }, 5000);
}

// Funkcje ładowania danych
async function refreshData() {
    try {
        // Załaduj WSZYSTKICH użytkowników plików (API stronicuje, max 200/stronę —
        // pętla po stronach). Wcześniej brana była tylko 1. strona => widać było 10.
        const fileUsers = await fetchAllFileUsers();
        if (fileUsers) {
            currentData.stats = fileUsers.stats;
            currentData.fileUsers = fileUsers.users;
            updateFileUsersTable();
        }

        // Załaduj statystyki zarejestrowanych użytkowników
        await loadRegisteredUsers();
        await loadAccessKeys();

        // Zaktualizuj statystyki DOPIERO po załadowaniu wszystkich danych
        updateStats();

        showAlert('Dane zostały odświeżone');
    } catch (error) {
        console.error('Error refreshing data:', error);
        showAlert('Błąd podczas odświeżania danych', 'error');
    }
}

async function loadAccessKeys() {
    try {
        const response = await fetch('/admin/api/access-keys');
        const data = await response.json();

        if (data.success) {
            currentData.accessKeys = data.access_keys;
            updateAccessKeysTable();
        }
    } catch (error) {
        console.error('Error loading access keys:', error);
        showAlert('Błąd podczas ładowania kluczy dostępu', 'error');
    }
}

async function loadRegisteredUsers() {
    try {
        const response = await fetch('/admin/api/registered-users');
        const data = await response.json();

        if (data.success) {
            currentData.registeredUsers = data.users;
            updateRegisteredUsersTable();
        }
    } catch (error) {
        console.error('Error loading registered users:', error);
        showAlert('Błąd podczas ładowania zarejestrowanych użytkowników', 'error');
    }
}

// Pobiera WSZYSTKICH użytkowników plików, przechodząc po wszystkich stronach API
// (/admin/api/users stronicuje, max 200/stronę). Bez tego widać było tylko 10.
async function fetchAllFileUsers() {
    const users = [];
    let stats = null;
    let page = 1;
    for (let guard = 0; guard < 1000; guard++) {
        const resp = await fetch(`/admin/api/users?page=${page}&per_page=200`);
        const data = await resp.json();
        if (!data.success) break;
        stats = data.stats;
        const ud = data.users_data || {};
        if (Array.isArray(ud.users)) users.push(...ud.users);
        if (!ud.has_next) break;
        page++;
    }
    return { users, stats };
}

async function loadFileUsers() {
    try {
        const fileUsers = await fetchAllFileUsers();
        if (fileUsers) {
            currentData.fileUsers = fileUsers.users;
            updateFileUsersTable();
        }
    } catch (error) {
        console.error('Error loading file users:', error);
        showAlert('Błąd podczas ładowania użytkowników plików', 'error');
    }
}

// Funkcje aktualizacji interfejsu
function updateStats() {
    document.getElementById('totalUsers').textContent = currentData.stats.total_users || 0;
    document.getElementById('totalFiles').textContent = currentData.stats.total_files || 0;
    document.getElementById('totalSize').textContent = formatBytes(currentData.stats.total_size || 0);
    document.getElementById('registeredUsersCount').textContent = currentData.registeredUsers.length;

    const activeKeys = currentData.accessKeys.filter(key => key.is_active).length;
    document.getElementById('activeKeysCount').textContent = activeKeys;
}

function updateAccessKeysTable() {
    const tbody = document.getElementById('accessKeysBody');

    if (currentData.accessKeys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Brak kluczy dostępu</td></tr>';
        return;
    }

    tbody.innerHTML = currentData.accessKeys.map(key => {
        const rawKey = String(key.key ?? '');
        const keyValue = escapeAttr(rawKey);
        const keyText = escapeHtml(rawKey);
        const keyShort = escapeHtml(rawKey.substring(0, 20));
        const keyDescription = escapeHtml(key.description || 'Brak opisu');
        return `
        <tr>
            <td class="csp-s-7c95f756">
                <div class="csp-s-74fa97c2" data-action="toggleKeyVisibility" data-pass-element="true" title="Kliknij aby pokazać/ukryć pełny klucz">
                    <span class="key-short">${keyShort}...</span>
                    <span class="key-full csp-s-5790ffba">${keyText}</span>
                </div>
            </td>
            <td>${keyDescription}</td>
            <td>${new Date(key.created_at).toLocaleString()}</td>
            <td>${key.expires_at ? new Date(key.expires_at).toLocaleString() : 'Nigdy'}</td>
            <td>${key.last_used ? new Date(key.last_used).toLocaleString() : 'Nigdy'}</td>
            <td>${key.used_count}</td>
            <td>
                <span class="csp-s-b94b9e88">
                    ${key.is_active ? 'Aktywny' : 'Nieaktywny'}
                </span>
            </td>
            <td>
                ${key.is_active ?
                    `<button class="btn btn-warning" data-action="deactivateKey" data-arg-0="${keyValue}">Dezaktywuj</button>` :
                    '<span class="csp-s-aeb2f1e0">Dezaktywowany</span>'
                }
                <button class="btn btn-danger" data-action="deleteKey" data-arg-0="${keyValue}">Usuń</button>
            </td>
        </tr>
    `;
    }).join('');
}

function updateRegisteredUsersTable() {
    const tbody = document.getElementById('registeredUsersBody');

    if (currentData.registeredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Brak zarejestrowanych użytkowników</td></tr>';
        return;
    }

    tbody.innerHTML = currentData.registeredUsers.map(user => {
        const rawUsername = String(user.username ?? '');
        const username = escapeAttr(rawUsername);
        const usernameText = escapeHtml(rawUsername);
        const rawAccessKey = String(user.access_key_used ?? '');
        const accessKeyText = rawAccessKey ? `${escapeHtml(rawAccessKey.substring(0, 20))}...` : 'Brak';
        const rawPassword = String(user.password ?? '');
        const passwordShort = rawPassword ? `${escapeHtml(rawPassword.substring(0, 16))}...` : 'Brak';
        const passwordFull = rawPassword ? escapeHtml(rawPassword) : 'Brak';
        return `
        <tr>
            <td><strong>${usernameText}</strong></td>
            <td>${new Date(user.created_at).toLocaleString()}</td>
            <td>${user.last_login ? new Date(user.last_login).toLocaleString() : 'Nigdy'}</td>
            <td class="csp-s-fc459a09">${accessKeyText}</td>
            <td class="csp-s-c56250b0">
                <div class="csp-s-74fa97c2" data-action="togglePasswordVisibility" data-pass-element="true" title="Kliknij aby pokazać/ukryć hash hasła">
                    <span class="password-short">${passwordShort}</span>
                    <span class="password-full csp-s-85bde476">${passwordFull}</span>
                </div>
            </td>
            <td>
                <span class="csp-s-2dce805c">
                    ${user.is_active ? 'Aktywny' : 'Nieaktywny'}
                </span>
            </td>
            <td>
                <button class="btn" data-action="toggleUserStatus" data-arg-0="${username}">${user.is_active ? 'Dezaktywuj' : 'Aktywuj'}</button>
                <button class="btn btn-danger" data-action="deleteRegisteredUser" data-arg-0="${username}" data-arg-1="true" data-arg-type-1="boolean">Usuń z Plikami</button>
                <button class="btn btn-warning" data-action="deleteRegisteredUser" data-arg-0="${username}" data-arg-1="false" data-arg-type-1="boolean">Usuń (Zachowaj Pliki)</button>
                <button class="btn" data-action="impersonateUser" data-arg-0="${username}" ${user.is_active ? '' : 'disabled title="Nie można impersonować nieaktywnego użytkownika"'}>Impersonuj</button>
            </td>
            <td>
                <button class="btn btn-warning" data-action="resetPasswordPrompt" data-arg-0="${username}">Resetuj Hasło</button>
            </td>
            <td>
                <div class="csp-s-4270057a">
                    <button class="btn btn-success" data-action="updateHubertCoins" data-arg-0="${username}" data-arg-1="1" data-arg-type-1="number">+</button>
                    <span class="csp-s-3991b956">${user.hubert_coins || 0}</span>
                    <button class="btn btn-warning" data-action="updateHubertCoins" data-arg-0="${username}" data-arg-1="-1" data-arg-type-1="number">-</button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function updateFileUsersTable() {
    const tbody = document.getElementById('fileUsersBody');

    if (currentData.fileUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Brak użytkowników do wyświetlenia</td></tr>';
        return;
    }

    tbody.innerHTML = currentData.fileUsers.map(user => {
        const rawUsername = String(user.name ?? '');
        const username = escapeAttr(rawUsername);
        const usernameText = escapeHtml(rawUsername);
        return `
        <tr>
            <td><strong>${usernameText}</strong></td>
            <td>${user.created_date ? new Date(user.created_date).toLocaleString() : 'Nieznana'}</td>
            <td>${user.last_activity ? new Date(user.last_activity).toLocaleString() : 'Nieznana'}</td>
            <td>${user.file_count}</td>
            <td>${formatBytes(user.total_size)}</td>
            <td>
                <button class="btn" data-action="viewUserLogs" data-arg-0="${username}">Logi</button>
                <button class="btn" data-action="downloadUserData" data-arg-0="${username}">Pobierz</button>
            </td>
        </tr>
    `;
    }).join('');
}

// Funkcje akcji
async function fetchLogs(logFileName) {
    const logViewer = document.getElementById('logViewer');
    const logFileNameHeader = document.getElementById('logFileName');

    logViewer.textContent = 'Ładowanie...';
    logFileNameHeader.textContent = `Podgląd: ${logFileName}`;

    try {
        const response = await fetch(`/admin/api/logs/${logFileName}`);
        const data = await response.json();

        if (data.success) {
            logViewer.textContent = data.log_content || 'Plik logów jest pusty.';
        } else {
            logViewer.textContent = `Błąd: ${data.error}`;
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Error fetching logs:', error);
        logViewer.textContent = 'Nie udało się pobrać logów. Sprawdź konsolę przeglądarki, aby uzyskać więcej informacji.';
        showAlert('Nie udało się pobrać logów.', 'error');
    }
}

// Pobieranie pojedynczego pliku logów
function downloadLog(logFileName) {
    showAlert(`Pobieranie ${logFileName}...`, 'success');
    window.location.href = `/admin/api/logs/${logFileName}/download`;
}

// Pobieranie wszystkich logów jako ZIP
function downloadAllLogs() {
    showAlert('Pobieranie wszystkich logów (ZIP)...', 'success');
    window.location.href = '/admin/api/logs/download-all';
}

// Restart serwera
function confirmRestart() {
    if (confirm('Czy na pewno chcesz zrestartować serwer?\n\nStrona będzie niedostępna przez kilka sekund.\nPo restarcie strona odświeży się automatycznie.')) {
        restartServer();
    }
}

async function restartServer() {
    const btn = document.getElementById('restartBtn');
    const status = document.getElementById('restartStatus');
            
    btn.disabled = true;
    btn.textContent = 'Restartowanie...';
    status.textContent = 'Wysyłanie polecenia restartu...';
    status.style.color = '#f39c12';
            
    try {
        const response = await fetch('/admin/api/restart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('meta[name="csrf-token"]')?.content || ''
            }
        });
                
        const data = await response.json();
                
        if (data.success) {
            status.textContent = 'Restart zainicjowany. Oczekiwanie na ponowne uruchomienie...';
            status.style.color = '#27ae60';
            showAlert('Serwer restartuje się. Strona odświeży się za chwilę...', 'success');
                    
            // Czekaj i próbuj odświeżyć stronę
            setTimeout(() => {
                status.textContent = 'Sprawdzanie dostępności serwera...';
                checkServerAndReload();
            }, 3000);
        } else {
            status.textContent = data.error;
            status.style.color = '#e74c3c';
            showAlert(data.error, 'error');
            btn.disabled = false;
            btn.textContent = 'Zrestartuj serwer';
        }
    } catch (error) {
        // Błąd połączenia może oznaczać, że serwer już się restartuje
        status.textContent = 'Serwer może już się restartować. Sprawdzanie...';
        status.style.color = '#f39c12';
        setTimeout(() => checkServerAndReload(), 2000);
    }
}

function checkServerAndReload(attempts = 0) {
    const status = document.getElementById('restartStatus');
    const maxAttempts = 30; // Max 30 prób (30 sekund)
            
    if (attempts >= maxAttempts) {
        status.textContent = 'Timeout. Odśwież stronę ręcznie.';
        status.style.color = '#e74c3c';
        document.getElementById('restartBtn').disabled = false;
        document.getElementById('restartBtn').textContent = 'Zrestartuj serwer';
        return;
    }
            
    fetch('/admin/api/stats', { method: 'GET' })
        .then(response => {
            if (response.ok) {
                status.textContent = 'Serwer działa. Odświeżanie strony...';
                status.style.color = '#27ae60';
                setTimeout(() => window.location.reload(), 500);
            } else {
                throw new Error('Server not ready');
            }
        })
        .catch(() => {
            status.textContent = `Oczekiwanie na serwer... (${attempts + 1}/${maxAttempts})`;
            setTimeout(() => checkServerAndReload(attempts + 1), 1000);
        });
}

async function sendAnnouncement() {
    const title = document.getElementById('announcementTitle').value;
    const message = document.getElementById('announcementMessage').value;
    const type = document.getElementById('announcementType').value;
    let expires_at = document.getElementById('announcementExpires').value;

    if (!title || !message) {
        showAlert('Tytuł i treść ogłoszenia są wymagane.', 'error');
        return;
    }

    // Format daty na ISO 8601, jeśli została podana
    if (expires_at) {
        // Dodajemy czas, aby upewnić się, że data jest interpretowana jako koniec dnia w lokalnej strefie czasowej
        expires_at = new Date(expires_at + "T23:59:59").toISOString();
    } else {
        expires_at = null;
    }

    try {
        const response = await fetch('/admin/api/announcements', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ title, message, type, expires_at })
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Ogłoszenie zostało wysłane!');
            document.getElementById('announcementTitle').value = '';
            document.getElementById('announcementMessage').value = '';
            document.getElementById('announcementExpires').value = '';
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Error sending announcement:', error);
        showAlert('Błąd podczas wysyłania ogłoszenia.', 'error');
    }
}

async function generateAccessKey() {
    const description = document.getElementById('keyDescription').value;
    const expires_days = parseInt(document.getElementById('keyExpires').value);

    try {
        const response = await fetch('/admin/api/generate-access-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                description: description,
                validity_days: expires_days
            })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('generatedKey').textContent = data.access_key;
            document.getElementById('keyModal').style.display = 'block';
            document.getElementById('keyDescription').value = '';
            await loadAccessKeys();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Error generating access key:', error);
        showAlert('Błąd podczas generowania klucza', 'error');
    }
}

async function deactivateKey(accessKey) {
    if (!confirm('Czy na pewno chcesz dezaktywować ten klucz?')) return;

    try {
        const response = await fetch('/admin/api/deactivate-access-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                access_key: accessKey
            })
        });

        const data = await response.json();

        if (data.success) {
            showAlert(data.message);
            await loadAccessKeys();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Error deactivating access key:', error);
        showAlert('Błąd podczas dezaktywacji klucza', 'error');
    }
}

async function deleteKey(accessKey) {
    if (!confirm('Czy na pewno chcesz usunąć ten klucz? Ta operacja jest nieodwracalna.')) return;

    try {
        const response = await fetch('/admin/api/delete-access-key', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                access_key: accessKey
            })
        });

        const data = await response.json();

        if (data.success) {
            showAlert(data.message);
            await loadAccessKeys();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting access key:', error);
        showAlert('Błąd podczas usuwania klucza', 'error');
    }
}

function toggleKeyVisibility(element) {
    const shortKey = element.querySelector('.key-short');
    const fullKey = element.querySelector('.key-full');

    if (shortKey.style.display === 'none') {
        shortKey.style.display = 'inline';
        fullKey.style.display = 'none';
    } else {
        shortKey.style.display = 'none';
        fullKey.style.display = 'inline';
    }
}

function togglePasswordVisibility(element) {
    const shortPassword = element.querySelector('.password-short');
    const fullPassword = element.querySelector('.password-full');

    if (shortPassword.style.display === 'none') {
        shortPassword.style.display = 'inline';
        fullPassword.style.display = 'none';
    } else {
        shortPassword.style.display = 'none';
        fullPassword.style.display = 'inline';
    }
}

async function toggleUserStatus(username) {
    try {
        const response = await fetch('/admin/api/toggle-user-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                username: username
            })
        });

        const data = await response.json();

        if (data.success) {
            showAlert(data.message);
            await loadRegisteredUsers();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Error toggling user status:', error);
        showAlert('Błąd podczas zmiany statusu użytkownika', 'error');
    }
}

async function deleteRegisteredUser(username, deleteFiles) {
    const confirmationMessage = deleteFiles 
        ? `Czy na pewno chcesz usunąć użytkownika ${username} ORAZ wszystkie jego pliki? Tej operacji nie można cofnąć.`
        : `Czy na pewno chcesz usunąć użytkownika ${username}? Jego pliki zostaną zachowane.`;

    if (!confirm(confirmationMessage)) return;

    try {
        const response = await fetch(`/admin/api/delete-registered-user/${encodeURIComponent(username)}?delete_files=${deleteFiles}`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': csrfToken
            }
        });

        const data = await response.json();

        if (data.success) {
            showAlert(data.message);
            await refreshData();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting registered user:', error);
        showAlert('Błąd podczas usuwania zarejestrowanego użytkownika', 'error');
    }
}

async function updateHubertCoins(username, amount) {
    try {
        const response = await fetch('/admin/api/update-hubert-coins', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                username: username,
                amount: amount
            })
        });

        const data = await response.json();

        if (data.success) {
            showAlert(data.message);
            await loadRegisteredUsers();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Error updating Hubert Coins:', error);
        showAlert('Błąd podczas aktualizacji Hubert Coinów', 'error');
    }
}

async function resetPasswordPrompt(username) {
    const newPassword = prompt(`Wprowadź nowe hasło dla użytkownika ${username}:`);
    if (newPassword === null || newPassword.trim() === '') {
        showAlert('Resetowanie hasła anulowane lub hasło jest puste.', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showAlert('Hasło musi mieć co najmniej 6 znaków.', 'error');
        return;
    }

    if (!confirm(`Czy na pewno chcesz zresetować hasło dla użytkownika ${username}?`)) {
        return;
    }

    try {
        const response = await fetch('/admin/api/reset-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                username: username,
                new_password: newPassword
            })
        });

        const data = await response.json();

        if (data.success) {
            showAlert(data.message);
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        showAlert('Błąd podczas resetowania hasła', 'error');
    }
}

// Funkcje dla użytkowników plików
function closeLogsModal() {
    document.getElementById('logsModal').style.display = 'none';
}

async function viewUserLogs(username) {
    try {
        const response = await fetch(`/admin/api/user-logs/${encodeURIComponent(username)}`);
        const data = await response.json();

        if (data.success) {
            const modalTitle = document.getElementById('logsModalTitle');
            const modalBody = document.getElementById('logsModalBody');

            modalTitle.textContent = `📊 Logi użytkownika: ${username}`;

            let content = '<h3>🖼️ Podgląd zdjęcia</h3>';
            const imagePreviewContainer = document.createElement('div');
            imagePreviewContainer.id = 'userImagePreview';
            imagePreviewContainer.style.marginBottom = '20px';
            imagePreviewContainer.style.textAlign = 'center';

            const files = Array.isArray(data.files) ? data.files : [];
            const submissions = Array.isArray(data.submissions) ? data.submissions : [];
            const imageFile = files.find(f => String(f.name || '').match(/\.(jpeg|jpg|gif|png)$/i));

            if (imageFile) {
                const imageUrl = `/user_files/${encodeURIComponent(username)}/${encodeURIComponent(imageFile.name)}`;
                imagePreviewContainer.innerHTML = `<img class="csp-s-ec5b5009" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(`Zdjęcie użytkownika ${username}`)}">`;
            } else {
                imagePreviewContainer.innerHTML = '<p>Użytkownik nie przesłał zdjęcia.</p>';
            }

            content += imagePreviewContainer.outerHTML;

            content += '<h3>Pliki</h3>';
            if (files.length > 0) {
                content += files.map(f => {
                    const fileName = escapeHtml(f.name || '');
                    const fileSize = formatBytes(f.size || 0);
                    const modified = f.modified ? new Date(f.modified).toLocaleString() : 'Nieznana';
                    return `<div class="log-entry">${fileName} (${fileSize}) - ${modified}</div>`;
                }).join('');
            } else {
                content += '<p>Brak plików.</p>';
            }

            content += '<h3>📋 Przesłane formularze</h3>';
            if (submissions.length > 0) {
                content += submissions.map(s => `
                    <div class="submission-entry">
                        <strong>Data:</strong> ${new Date(s.timestamp).toLocaleString()}<br>
                        <strong>IP:</strong> ${escapeHtml(s.ip_address || '')}
                        <pre>${escapeHtml(JSON.stringify(s.form_data, null, 2))}</pre>
                    </div>
                `).join('');
            } else {
                content += '<p>Brak przesłanych formularzy.</p>';
            }

            // Logi aktywności (actions.log) — wcześniej API je zwracało, ale modal
            // ich nie wyświetlał.
            const logs = Array.isArray(data.logs) ? data.logs : [];
            content += '<h3>📜 Logi aktywności</h3>';
            if (logs.length > 0) {
                content += logs
                    .map(l => `<div class="log-entry">${escapeHtml(l)}</div>`)
                    .join('');
            } else {
                content += '<p>Brak logów aktywności.</p>';
            }

            modalBody.innerHTML = content;
            document.getElementById('logsModal').style.display = 'block';
        } else {
            showAlert(data.error || 'Błąd podczas pobierania logów', 'error');
        }
    } catch (error) {
        console.error('Error viewing user logs:', error);
        showAlert('Błąd podczas pobierania logów', 'error');
    }
}

async function downloadUserData(username) {
    try {
        const response = await fetch(`/admin/api/download-user/${encodeURIComponent(username)}`);

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${username}_data.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showAlert(`Dane użytkownika ${username} zostały pobrane`);
        } else {
            const data = await response.json();
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Error downloading user data:', error);
        showAlert('Błąd podczas pobierania danych użytkownika', 'error');
    }
}

async function deleteRegisteredUser(username) {
    if (!confirm(`Czy na pewno chcesz usunąć użytkownika ${username} i wszystkie jego dane? Tej operacji nie można cofnąć.`)) return;

    try {
        const response = await fetch(`/admin/api/delete-registered-user/${encodeURIComponent(username)}`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': csrfToken
            }
        });

        const data = await response.json();

        if (data.success) {
            showAlert(data.message);
            await refreshData();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting registered user:', error);
        showAlert('Błąd podczas usuwania zarejestrowanego użytkownika', 'error');
    }
}

async function deleteUserFiles(username) {
    if (!confirm(`Czy na pewno chcesz usunąć WSZYSTKIE pliki użytkownika ${username}? Konto użytkownika NIE zostanie usunięte.`)) return;

    try {
        const response = await fetch(`/admin/api/delete-user-files/${encodeURIComponent(username)}`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': csrfToken
            }
        });

        const data = await response.json();

        if (data.success) {
            showAlert(data.message);
            await refreshData();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting user files:', error);
        showAlert('Błąd podczas usuwania plików użytkownika', 'error');
    }
}

async function impersonateUser(username) {
    if (!confirm(`Czy na pewno chcesz impersonować użytkownika ${username}? Zostaniesz wylogowany ze swojego konta admina i zalogowany jako ten użytkownik.`)) return;

    try {
        const response = await fetch(`/admin/api/impersonate/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ username: username })
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Rozpoczynanie impersonacji... Przekierowywanie.');
            window.location.href = '/'; // Przekieruj na stronę główną jako nowy użytkownik
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Error impersonating user:', error);
        showAlert('Błąd podczas próby impersonacji.', 'error');
    }
}

// Funkcje pomocnicze
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#fileUsersBody tr');

    rows.forEach(row => {
        const username = row.cells[0]?.textContent.toLowerCase() || '';
        if (username.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function closeKeyModal() {
    document.getElementById('keyModal').style.display = 'none';
}

async function copyToClipboard() {
    const keyText = document.getElementById('generatedKey').textContent;
    try {
        await navigator.clipboard.writeText(keyText);
        showAlert('Klucz został skopiowany do schowka!');
    } catch (err) {
        console.error('Błąd podczas kopiowania klucza za pomocą navigator.clipboard:', err);
        // Fallback for older browsers or non-secure contexts
        try {
            const textArea = document.createElement('textarea');
            textArea.value = keyText;
            textArea.style.position = 'fixed'; // Avoid scrolling to bottom
            textArea.style.left = '-9999px'; // Hide from view
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
            showAlert('Klucz został skopiowany do schowka (fallback)!');
        } catch (fallbackErr) {
            console.error('Błąd podczas kopiowania klucza za pomocą document.execCommand:', fallbackErr);
            showAlert('Nie udało się skopiować klucza.', 'error');
        }
    }
}

function safeJsonParse(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
}

function describeUnexpectedAdminResponse(status, text) {
    const trimmed = (text || '').trim();
    if (status === 413) {
        return 'Serwer odrzucił plik jako zbyt duży. Sprawdź limit uploadu aplikacji i reverse proxy.';
    }
    if (trimmed.startsWith('<')) {
        return `Serwer zwrócił stronę HTML zamiast JSON (HTTP ${status}). Najczęściej oznacza to limit uploadu albo błąd proxy.`;
    }
    return `Serwer zwrócił nieprawidłową odpowiedź (HTTP ${status}).`;
}

function updateImportProgress(percent, label, meta, state = 'active') {
    const wrap = document.getElementById('importProgressWrap');
    const labelEl = document.getElementById('importProgressLabel');
    const percentEl = document.getElementById('importProgressPercent');
    const bar = document.getElementById('importProgressBar');
    const metaEl = document.getElementById('importProgressMeta');
    if (!wrap || !labelEl || !percentEl || !bar || !metaEl) return;

    const clamped = Math.max(0, Math.min(100, Math.round(percent || 0)));
    wrap.style.display = 'block';
    labelEl.textContent = label || 'Przetwarzanie...';
    percentEl.textContent = `${clamped}%`;
    bar.style.width = `${clamped}%`;
    bar.style.background = state === 'error' ? '#e74c3c' : (state === 'success' ? '#27ae60' : '#3498db');
    metaEl.textContent = meta || '';
}

function hideImportProgress() {
    const wrap = document.getElementById('importProgressWrap');
    if (wrap) wrap.style.display = 'none';
}

function uploadFormData(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.timeout = 30 * 60 * 1000;
        xhr.setRequestHeader('X-CSRFToken', csrfToken);

        xhr.upload.addEventListener('progress', function(event) {
            if (!event.lengthComputable || typeof onProgress !== 'function') return;
            onProgress(event.loaded / event.total, event.loaded, event.total);
        });

        xhr.addEventListener('load', function() {
            resolve({
                ok: xhr.status >= 200 && xhr.status < 300,
                status: xhr.status,
                text: xhr.responseText || ''
            });
        });

        xhr.addEventListener('error', function() {
            reject(new Error('Błąd sieci podczas wysyłania pliku.'));
        });

        xhr.addEventListener('timeout', function() {
            reject(new Error('Przekroczono limit czasu podczas wysyłania pliku.'));
        });

        xhr.send(formData);
    });
}

// Inicjalizacja
document.addEventListener('DOMContentLoaded', function() {
    refreshData();

    // Obsługa formularza importu
    const importForm = document.getElementById('importForm');
    const importSubmitBtn = importForm.querySelector('button[type="submit"]');
    importForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const fileInput = document.getElementById('backupFile');
        const file = fileInput.files[0];

        if (!file) {
            showAlert('Proszę wybrać plik do importu.', 'error');
            return;
        }

        const setImportBusy = (busy) => {
            fileInput.disabled = busy;
            importSubmitBtn.disabled = busy;
            importSubmitBtn.textContent = busy ? 'Import trwa...' : 'Importuj i Nadpisz Dane';
        };

        try {
            setImportBusy(true);
            updateImportProgress(1, 'Przesyłanie pliku do walidacji...', `Rozmiar archiwum: ${formatBytes(file.size)}`);

            // 1) Pre-validation without changing current data.
            const validationFormData = new FormData();
            validationFormData.append('backupFile', file);
            const validationResponse = await uploadFormData('/admin/api/import/validate', validationFormData, (progress) => {
                updateImportProgress(
                    Math.max(1, Math.round(progress * 45)),
                    'Przesyłanie pliku do walidacji...',
                    `Wysłano ${formatBytes(file.size * progress)} z ${formatBytes(file.size)}`
                );
            });

            updateImportProgress(50, 'Walidacja archiwum na serwerze...', 'Odczytywanie odpowiedzi z serwera.');
            const validationData = safeJsonParse(validationResponse.text);
            if (!validationData) {
                throw new Error(describeUnexpectedAdminResponse(validationResponse.status, validationResponse.text));
            }
            if (!validationResponse.ok || !validationData.success) {
                const msg = validationData.error || 'Walidacja importu nie powiodła się.';
                updateImportProgress(100, 'Walidacja nie powiodła się.', msg, 'error');
                showAlert(msg, 'error');
                return;
            }

            if (!validationData.valid) {
                const issues = (validationData.issues || []).join('\n- ');
                updateImportProgress(100, 'Import zablokowany.', 'Archiwum nie przeszło walidacji.', 'error');
                showAlert(`Import zablokowany. Wykryte problemy:\n- ${issues}`, 'error');
                return;
            }

            const schemaPreview = (validationData.schema_updates_preview || []);
            const previewMessage = schemaPreview.length
                ? `\n\nPlanowane poprawki schematu:\n- ${schemaPreview.join('\n- ')}`
                : '\n\nBrak wymaganych poprawek schematu.';

            if (!confirm(
                'Walidacja zakończona sukcesem.\n\nCzy na pewno chcesz zaimportować dane? Operacja podmieni obecne dane.' +
                previewMessage
            )) {
                hideImportProgress();
                return;
            }

            // 2) Real import after successful validation.
            const importFormData = new FormData();
            importFormData.append('backupFile', file);
            updateImportProgress(55, 'Przesyłanie pliku do importu...', `Rozmiar archiwum: ${formatBytes(file.size)}`);
            const response = await uploadFormData('/admin/api/import/all', importFormData, (progress) => {
                const percent = 55 + Math.round(progress * 35);
                updateImportProgress(
                    percent,
                    'Przesyłanie pliku do importu...',
                    `Wysłano ${formatBytes(file.size * progress)} z ${formatBytes(file.size)}`
                );
            });

            updateImportProgress(95, 'Serwer finalizuje import...', 'Czekam na końcową odpowiedź aplikacji.');
            const data = safeJsonParse(response.text);
            if (!data) {
                throw new Error(describeUnexpectedAdminResponse(response.status, response.text));
            }

            if (data.success) {
                const importIdMessage = data.import_id ? ` (Import ID: ${data.import_id})` : '';
                updateImportProgress(100, 'Import zakończony pomyślnie.', `${data.message}${importIdMessage}`, 'success');
                showAlert(`${data.message}${importIdMessage}`, 'success');
                fileInput.value = ''; // Clear the file input
            } else {
                const details = Array.isArray(data.details) && data.details.length
                    ? `\nSzczegóły:\n- ${data.details.join('\n- ')}`
                    : '';
                updateImportProgress(100, 'Import nie powiódł się.', data.error || 'Błąd importu.', 'error');
                showAlert(`${data.error || 'Błąd importu.'}${details}`, 'error');
            }
        } catch (error) {
            console.error('Error importing data:', error);
            const message = error && error.message
                ? error.message
                : 'Wystąpił krytyczny błąd podczas importu.';
            updateImportProgress(100, 'Import przerwany.', message, 'error');
            showAlert(message, 'error');
        } finally {
            setImportBusy(false);
        }
    });
});

// Funkcja do eksportu danych
function exportAllData() {
    showAlert('Rozpoczynam przygotowywanie archiwum do eksportu...');
    window.location.href = '/admin/api/export/all';
}

async function refreshDocuments() {
    const checkboxes = document.querySelectorAll('.refresh-doc-type:checked');
    const docTypes = Array.from(checkboxes).map(cb => cb.value);

    if (docTypes.length === 0) {
        showAlert('Zaznacz przynajmniej jeden typ dokumentu.', 'error');
        return;
    }

    const btn = document.getElementById('refreshDocsBtn');
    const resultDiv = document.getElementById('refreshDocsResult');
    btn.disabled = true;
    btn.textContent = 'Odświeżanie...';
    resultDiv.style.display = 'none';

    try {
        const response = await fetch('/admin/api/refresh-documents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ doc_types: docTypes })
        });

        const data = await response.json();
        resultDiv.style.display = 'block';

        if (data.success) {
            let html = `<strong class="csp-s-d9f255d3">Odświeżono ${escapeHtml(data.refreshed)} dokumentów.</strong>`;
            if (data.skipped > 0) {
                html += `<br>Pominięto ${escapeHtml(data.skipped)} użytkowników (brak zapisanych danych).`;
            }
            if (data.errors && data.errors.length > 0) {
                html += `<br><br><strong class="csp-s-28191cb9">Błędy (${data.errors.length}):</strong><ul>`;
                data.errors.forEach(e => html += `<li>${escapeHtml(e)}</li>`);
                html += '</ul>';
            }
            resultDiv.innerHTML = html;
            resultDiv.style.background = '#1a2634';
            resultDiv.style.border = '1px solid #27ae60';
        } else {
            resultDiv.innerHTML = `<strong class="csp-s-28191cb9">Błąd: ${escapeHtml(data.error)}</strong>`;
            resultDiv.style.background = '#2d1a1a';
            resultDiv.style.border = '1px solid #e74c3c';
        }
    } catch (error) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<strong class="csp-s-28191cb9">Błąd połączenia z serwerem.</strong>';
        resultDiv.style.background = '#2d1a1a';
        resultDiv.style.border = '1px solid #e74c3c';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Odśwież dokumenty';
    }
}

async function forceCacheClear() {
    const btn = document.getElementById('forceCacheBtn');
    const resultDiv = document.getElementById('cacheResult');
    btn.disabled = true;
    btn.textContent = 'Czyszczenie...';

    try {
        const response = await fetch('/admin/api/force-cache-refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        resultDiv.style.display = 'block';

        if (data.success) {
            resultDiv.innerHTML = `<strong class="csp-s-d9f255d3">${escapeHtml(data.message)}</strong>`;
            resultDiv.style.background = '#1a2634';
            resultDiv.style.border = '1px solid #27ae60';
        } else {
            resultDiv.innerHTML = `<strong class="csp-s-28191cb9">Błąd: ${escapeHtml(data.error)}</strong>`;
            resultDiv.style.background = '#2d1a1a';
            resultDiv.style.border = '1px solid #e74c3c';
        }
    } catch (error) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<strong class="csp-s-28191cb9">Błąd połączenia z serwerem.</strong>';
        resultDiv.style.background = '#2d1a1a';
        resultDiv.style.border = '1px solid #e74c3c';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Wymuś odświeżenie cache';
    }
}

// Zamknij modal po kliknięciu poza nim
document.addEventListener('click', function(event) {
    const modal = document.getElementById('keyModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});


// ===== CSP-compliance: delegated event dispatcher (auto-generated) =====
document.addEventListener('click', function (e) {
    const target = e.target && e.target.closest && e.target.closest('[data-action]');
    if (!target) { return; }
    const action = target.getAttribute('data-action');
    const args = [];
    for (let i = 0; i < 8; i++) {
        const v = target.getAttribute('data-arg-' + i);
        if (v === null) { break; }
        const type = target.getAttribute('data-arg-type-' + i);
        if (type === 'boolean') {
            args.push(v === 'true');
        } else if (type === 'number') {
            args.push(Number(v));
        } else {
            args.push(v);
        }
    }
    if (target.getAttribute('data-pass-element') === 'true') {
        args.push(target);
    }
    const fn = (typeof window !== 'undefined') ? window[action] : undefined;
    if (typeof fn === 'function') {
        fn.apply(null, args);
    } else {
        console.warn('[CSP dispatcher] no global function:', action);
    }
});

document.addEventListener('keyup', function (e) {
    const target = e.target && e.target.closest && e.target.closest('[data-keyup-action]');
    if (!target) { return; }
    const action = target.getAttribute('data-keyup-action');
    const args = [];
    for (let i = 0; i < 8; i++) {
        const v = target.getAttribute('data-arg-' + i);
        if (v === null) { break; }
        args.push(v);
    }
    const fn = (typeof window !== 'undefined') ? window[action] : undefined;
    if (typeof fn === 'function') {
        fn.apply(null, args);
    } else {
        console.warn('[CSP dispatcher] no global function:', action);
    }
});
