// Extracted from inline <script> in templates/index.html for CSP compliance.
document.addEventListener('DOMContentLoaded', function() {
    const bootstrapElement = document.getElementById('index-bootstrap');
    let bootstrapData = {};
    if (bootstrapElement) {
        try {
            bootstrapData = JSON.parse(bootstrapElement.textContent);
        } catch (error) {
            console.error('Nie udało się odczytać danych startowych strony:', error);
        }
    }

    const lastFormData =
        bootstrapData.lastFormData && typeof bootstrapData.lastFormData === 'object'
            ? bootstrapData.lastFormData
            : {};
    const currentUsername = typeof bootstrapData.username === 'string'
        ? bootstrapData.username
        : '';
    const hasSeenTutorial = Boolean(bootstrapData.hasSeenTutorial);
    let tutorialCompleted = hasSeenTutorial;
    let currentStep = 0;
    let saveStepIndex = -1;
    let afterSaveStepIndex = -1;

    // --- TEMPLATE SELECTOR LOGIC ---
    function updateTemplateFields() {
        const selected = document.querySelector('input[name="template_version"]:checked');
        if (!selected) return;
        const val = selected.value;
        document.querySelectorAll('.template-fields').forEach(function(el) {
            el.classList.toggle('active', el.dataset.template === val);
        });
        // Hide demo panel for non-mDowód templates
        const demoPanel = document.querySelector('.id-demo-panel');
        if (demoPanel) {
            demoPanel.style.display = (val === 'new_mprawojazdy' || val === 'new_wozek' || val === 'new_school_id' || val === 'new_student_id') ? 'none' : '';
        }
    }
    document.querySelectorAll('input[name="template_version"]').forEach(function(radio) {
        radio.addEventListener('change', updateTemplateFields);
    });
    updateTemplateFields();

    // --- ALL-IN-ONE FUNCTIONS ---
    async function fetchAllinoneDocStatus() {
        try {
            const resp = await fetch('/api/user-documents');
            const data = await resp.json();
            if (data.success && data.data && data.data.documents) {
                const docs = data.data.documents;
                document.querySelectorAll('.allinone-doc-status').forEach(function(el) {
                    const key = el.dataset.doc;
                    // Kolor statusu sterowany klasą w CSS (is-ready/is-missing),
                    // nie inline — żeby był spójny z paletą i sterowalny motywem.
                    const cb = el.closest('label').querySelector('input[type="checkbox"]');
                    if (docs[key]) {
                        el.textContent = '✓ Wygenerowany';
                        el.classList.add('is-ready');
                        el.classList.remove('is-missing');
                        if (cb) cb.disabled = false;
                    } else {
                        el.textContent = '✗ Brak';
                        el.classList.add('is-missing');
                        el.classList.remove('is-ready');
                        if (cb) { cb.disabled = true; cb.checked = false; }
                    }
                });
            }
        } catch (e) {
            console.error('Błąd pobierania statusu dokumentów:', e);
        }
    }
    window.refreshAllinoneDocStatus = fetchAllinoneDocStatus;

    // Compile All-in-One button handler
    const allinoneCompileBtn = document.getElementById('allinone-compile-btn');
    if (allinoneCompileBtn) {
        allinoneCompileBtn.addEventListener('click', async function() {
            const checkboxes = document.querySelectorAll('input[name="allinone_doc"]:checked:not(:disabled)');
            const selectedDocs = Array.from(checkboxes).map(cb => cb.value);
            const allinoneMessage = document.getElementById('allinone-modal-message');
            if (selectedDocs.length === 0) {
                setInlineMessage('allinone-modal-message', 'Wybierz co najmniej jeden zapisany dokument.', 'error');
                return;
            }
            const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
            const loadingOverlay = document.getElementById('loadingOverlay');
            loadingOverlay.classList.add('visible');
            allinoneCompileBtn.disabled = true;
            allinoneCompileBtn.textContent = 'Kompilowanie...';
            if (allinoneMessage) {
                setInlineMessage('allinone-modal-message', 'Tworzę All-in-One...', 'info');
            }
            try {
                const resp = await fetch('/api/compile-allinone', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({ selected_docs: selectedDocs })
                });
                const result = await resp.json();
                if (result.success) {
                    logAction('Compiled All-in-One with docs: ' + selectedDocs.join(', '));
                    window.location.href = result.redirect_url || '/user_files/allinone.html#login';
                } else {
                    setInlineMessage('allinone-modal-message', result.error || 'Nie udało się skompilować All-in-One.', 'error');
                }
            } catch (error) {
                console.error('Error compiling All-in-One:', error);
                setInlineMessage('allinone-modal-message', 'Wystąpił błąd podczas kompilacji All-in-One.', 'error');
            } finally {
                loadingOverlay.classList.remove('visible');
                allinoneCompileBtn.disabled = false;
                allinoneCompileBtn.textContent = 'Kompiluj i przejdź do logowania';
            }
        });
    }

    // --- GENERAL HELPER FUNCTIONS ---
    function logAction(actionDescription) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        fetch('/api/log-action', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ action: actionDescription }),
        }).catch(error => console.error('Error logging action:', error));
    }

    function showAlert(message, type = 'info') {
        Swal.fire({
            title: type.charAt(0).toUpperCase() + type.slice(1),
            text: message,
            icon: type,
            confirmButtonColor: '#667789',
            background: '#1b1f24',
            color: '#eef1f4'
        });
    }

    function setInlineMessage(id, message, type = 'info') {
        const node = document.getElementById(id);
        if (!node) return;
        node.textContent = message || '';
        node.classList.remove('is-error', 'is-success', 'is-info');
        if (message) {
            node.classList.add(type === 'success' ? 'is-success' : type === 'error' ? 'is-error' : 'is-info');
        }
    }

    function setFieldError(field, active) {
        if (!field) return;
        field.classList.toggle('field-error', Boolean(active));
    }

    function showNotification(title, message, type) {
        document.getElementById('notificationTitle').textContent = title;
        document.getElementById('notificationMessage').textContent = message;
        document.getElementById('notificationModal').style.display = 'block';
    }

    const mobileActionDock = document.getElementById('mobileActionDock');
    const userStatusPanel = document.querySelector('.user-status');
    const profileButtons = document.querySelectorAll('a[href="/profile"]');

    profileButtons.forEach((btn) => {
        if (btn && btn.classList.contains('logout-btn')) {
            btn.textContent = 'Profil / Dokument';
        }
    });

    function getScrollTopY() {
        return (
            window.scrollY ||
            window.pageYOffset ||
            document.documentElement.scrollTop ||
            document.body.scrollTop ||
            0
        );
    }

    function updateMobileActionDockVisibility() {
        if (!mobileActionDock) return;

        const isMobileLayout = window.matchMedia('(max-width: 900px)').matches;
        if (!isMobileLayout) {
            mobileActionDock.classList.remove('is-visible');
            mobileActionDock.setAttribute('aria-hidden', 'true');
            if (userStatusPanel) userStatusPanel.classList.remove('is-condensed');
            return;
        }

        const shouldShow = getScrollTopY() > 60;
        mobileActionDock.classList.toggle('is-visible', shouldShow);
        mobileActionDock.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
        if (userStatusPanel) userStatusPanel.classList.toggle('is-condensed', shouldShow);
    }

    updateMobileActionDockVisibility();
    window.addEventListener('scroll', updateMobileActionDockVisibility, { passive: true });
    window.addEventListener('touchmove', updateMobileActionDockVisibility, { passive: true });
    window.addEventListener('wheel', updateMobileActionDockVisibility, { passive: true });
    window.addEventListener('resize', updateMobileActionDockVisibility);

    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewCard = document.getElementById('imagePreviewCard');
    const imagePreviewCardPlaceholder = document.getElementById('imagePreviewCardPlaceholder');
    let uploadObjectUrl = null;

    function clearUploadObjectUrl() {
        if (uploadObjectUrl) {
            URL.revokeObjectURL(uploadObjectUrl);
            uploadObjectUrl = null;
        }
    }

    function updateImagePreviews(imageSrc) {
        const hasImage = Boolean(imageSrc);

        if (imagePreview) {
            imagePreview.src = hasImage ? imageSrc : '';
            imagePreview.style.display = hasImage ? 'block' : 'none';
        }

        if (imagePreviewCard) {
            imagePreviewCard.src = hasImage ? imageSrc : '';
            imagePreviewCard.style.display = hasImage ? 'block' : 'none';
        }

        if (imagePreviewCardPlaceholder) {
            imagePreviewCardPlaceholder.style.display = hasImage ? 'none' : 'inline';
        }
    }

    function formatDemoValue(value, fallback = '—') {
        if (!value || typeof value !== 'string') return fallback;
        const cleaned = value.trim();
        return cleaned ? cleaned.toUpperCase() : fallback;
    }

    function updateIdCardDemoText() {
        const mappings = [
            { inputId: 'imie', outputId: 'demoImie', fallback: 'IMIĘ' },
            { inputId: 'nazwisko', outputId: 'demoNazwisko', fallback: 'NAZWISKO' },
            { inputId: 'obywatelstwo', outputId: 'demoObywatelstwo', fallback: 'POLSKIE' },
            { inputId: 'data_urodzenia', outputId: 'demoDataUrodzenia', fallback: '15.03.1985' },
            { inputId: 'pesel', outputId: 'demoPesel', fallback: '85031512345' }
        ];

        mappings.forEach(({ inputId, outputId, fallback }) => {
            const input = document.getElementById(inputId);
            const output = document.getElementById(outputId);
            if (!output) return;
            output.textContent = formatDemoValue(input ? input.value : '', fallback);
        });
    }

    window.closeNotificationModal = function() {
        document.getElementById('notificationModal').style.display = 'none';
    }

    const postSaveActions = document.getElementById('postSaveActions');
    const openDocumentBtn = document.getElementById('openDocumentBtn');
    const documentDisclaimerModal = document.getElementById('documentDisclaimerModal');
    const disclaimerAgree = document.getElementById('disclaimerAgree');
    const cancelOpenDocumentBtn = document.getElementById('cancelOpenDocumentBtn');
    const confirmOpenDocumentBtn = document.getElementById('confirmOpenDocumentBtn');

    function showPostSaveActions() {
        if (!postSaveActions) return;
        postSaveActions.classList.remove('hidden');
        postSaveActions.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function openDocumentDisclaimer() {
        if (!documentDisclaimerModal) return;
        documentDisclaimerModal.style.display = 'block';
        if (disclaimerAgree) disclaimerAgree.checked = false;
        if (confirmOpenDocumentBtn) confirmOpenDocumentBtn.disabled = true;
    }

    function closeDocumentDisclaimer() {
        if (!documentDisclaimerModal) return;
        documentDisclaimerModal.style.display = 'none';
    }

    if (openDocumentBtn) {
        openDocumentBtn.addEventListener('click', function() {
            logAction("Clicked 'Go to document' button.");
            const generatedDocumentButton = document.getElementById('openGeneratedDocumentBtn');
            if (generatedDocumentButton) {
                generatedDocumentButton.click();
                return;
            }
            openDocumentDisclaimer();
        });
    }

    if (cancelOpenDocumentBtn) {
        cancelOpenDocumentBtn.addEventListener('click', function() {
            closeDocumentDisclaimer();
        });
    }

    if (disclaimerAgree && confirmOpenDocumentBtn) {
        disclaimerAgree.addEventListener('change', function() {
            confirmOpenDocumentBtn.disabled = !disclaimerAgree.checked;
        });
    }

    if (confirmOpenDocumentBtn) {
        confirmOpenDocumentBtn.addEventListener('click', function() {
            if (!disclaimerAgree || !disclaimerAgree.checked) return;
            logAction("Accepted educational disclaimer and opened documents page.");
            // Płynne wygaszenie przed nawigacją (fallback: zwykłe przekierowanie).
            (window.navigateWithTransition || function (u) { window.location.href = u; })(
                '/logowaniedozmodyfikowanieplikuhtml'
            );
        });
    }

    // --- FORM LOGIC ---
    async function generatePESEL() {
        const birthDateInput = document.getElementById('data_urodzenia');
        const genderSelect = document.getElementById('plec');
        const peselInput = document.getElementById('pesel');
        const birthDate = birthDateInput.value;
        const gender = genderSelect.value;
        setFieldError(birthDateInput, !birthDate);
        setFieldError(genderSelect, !gender);

        if (!birthDate || !gender) {
            setInlineMessage('pesel-message', 'Uzupełnij datę urodzenia i płeć, aby wygenerować PESEL.', 'error');
            return;
        }

        try {
            setInlineMessage('pesel-message', 'Generowanie numeru PESEL...', 'info');
            const response = await fetch('/generate_pesel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                },
                body: JSON.stringify({ birth_date: birthDate, gender: gender }),
            });
            const data = await response.json();
            if (data.success) {
                peselInput.value = data.pesel;
                updateIdCardDemoText();
                setInlineMessage('pesel-message', 'PESEL został wygenerowany.', 'success');
                if (!tutorialCompleted && isTutorialStep('pesel') && saveStepIndex >= 0) {
                    window.setTimeout(() => showTutorialStep(saveStepIndex), 650);
                }
            } else {
                setInlineMessage('pesel-message', data.error || 'Nie udało się wygenerować numeru PESEL.', 'error');
            }
        } catch (error) {
            console.error('Błąd podczas generowania PESEL:', error);
            setInlineMessage('pesel-message', 'Wystąpił błąd komunikacji z serwerem.', 'error');
        }
    }

    window.clearForm = function() {
        logAction("Clicked 'Clear form' button.");
        document.getElementById('mainForm').reset();
        const inputs = document.getElementById('mainForm').querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.type === 'radio' || input.type === 'checkbox') {
                input.checked = false;
            } else if (input.type !== 'hidden') {
                input.value = '';
            }
        });
        clearUploadObjectUrl();
        updateImagePreviews('');
        updateIdCardDemoText();
        setInlineMessage('pesel-message', '');
        setInlineMessage('random-data-message', '');
        setFieldError(document.getElementById('data_urodzenia'), false);
        setFieldError(document.getElementById('plec'), false);
    }

    document.getElementById('mainForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        // All-in-One has its own compile button — don't submit the form
        const versionRadio = document.querySelector('input[name="template_version"]:checked');
        logAction("Clicked 'Modify and Save' button (form submission).");
        const loadingOverlay = document.getElementById('loadingOverlay');
        const submitBtn = document.querySelector('.submit-btn');
        loadingOverlay.classList.add('visible');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Ładowanie...';
        const formData = new FormData(this);
        formData.append('template_version', versionRadio ? versionRadio.value : 'new');
        try {
            const response = await fetch('/', { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success) {
                showNotification('Sukces!', result.message, 'success');
                showPostSaveActions();
                if (!tutorialCompleted && currentStep === saveStepIndex && afterSaveStepIndex >= 0) {
                    showTutorialStep(afterSaveStepIndex);
                }
            } else {
                showNotification('Błąd!', result.error, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Błąd!', 'Wystąpił błąd podczas wysyłania danych.', 'error');
        } finally {
            loadingOverlay.classList.remove('visible');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Modyfikuj i Zapisz';
        }
    });

    document.getElementById('image_upload').addEventListener('change', function(event) {
        const [file] = event.target.files;
        if (file) {
            logAction(`Selected an image to upload: ${file.name}`);
            clearUploadObjectUrl();
            uploadObjectUrl = URL.createObjectURL(file);
            updateImagePreviews(uploadObjectUrl);
            if (!tutorialCompleted && isTutorialStep('photo')) {
                window.setTimeout(() => showTutorialStepById('demo'), 550);
            }
        } else {
            clearUploadObjectUrl();
            updateImagePreviews('');
        }
    });

    const generateRandomBtn = document.getElementById('generate-random-data-btn');
    if (generateRandomBtn) {
        generateRandomBtn.addEventListener('click', async function() {
            logAction("Clicked 'Generate random data' button.");
            const plecSelect = document.getElementById('plec');
            const selectedPlec = plecSelect.value;
            setInlineMessage('random-data-message', '');
            if (!selectedPlec) {
                setFieldError(plecSelect, true);
                setInlineMessage('random-data-message', 'Najpierw wybierz płeć w danych osobowych.', 'error');
                return;
            }
            setFieldError(plecSelect, false);
            try {
                setInlineMessage('random-data-message', 'Losowanie danych...', 'info');
                const response = await fetch(`/api/generate-random-data?plec=${selectedPlec}`, {
                    method: 'GET',
                    headers: { 'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').getAttribute('content') }
                });
                if (!response.ok) throw new Error('Błąd sieci lub serwera');
                const data = await response.json();
                for (const [key, value] of Object.entries(data)) {
                    const element = document.getElementById(key);
                    if (element) element.value = value;
                }
                updateIdCardDemoText();
                setInlineMessage('random-data-message', 'Dane zostały uzupełnione.', 'success');
                if (!tutorialCompleted && isTutorialStep('random')) {
                    window.setTimeout(() => showTutorialStepById('pesel'), 650);
                }
            } catch (error) {
                console.error('Błąd podczas pobierania losowych danych:', error);
                setInlineMessage('random-data-message', 'Nie udało się załadować losowych danych.', 'error');
            }
        });
    }

    const generatePeselBtn = document.querySelector('.generate-pesel-btn');
    if (generatePeselBtn) {
        generatePeselBtn.addEventListener('click', generatePESEL);
    }

    ['imie', 'nazwisko', 'obywatelstwo', 'data_urodzenia', 'pesel'].forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        if (!field) return;
        field.addEventListener('input', updateIdCardDemoText);
        field.addEventListener('change', updateIdCardDemoText);
    });

    ['data_urodzenia', 'plec'].forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        if (!field) return;
        field.addEventListener('input', function() {
            setFieldError(field, false);
            setInlineMessage('pesel-message', '');
            setInlineMessage('random-data-message', '');
        });
        field.addEventListener('change', function() {
            setFieldError(field, false);
            setInlineMessage('pesel-message', '');
            setInlineMessage('random-data-message', '');
        });
    });

    // --- INITIAL DATA POPULATION ---
    for (const [key, value] of Object.entries(lastFormData)) {
        const element = document.getElementById(key);
        if (element) {
            if (element.type === 'date' && typeof value === 'string') {
                const dateParts = value.split('.');
                if (dateParts.length === 3) {
                    element.value = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
                } else {
                    element.value = value;
                }
            } else {
                element.value = value;
            }
        }
    }
    const imageFilename = lastFormData.image_filename;
    if (imageFilename && currentUsername) {
        const imageUrl = `/user_files/${encodeURIComponent(currentUsername)}/${imageFilename}`;
        clearUploadObjectUrl();
        updateImagePreviews(imageUrl);
    } else {
        updateImagePreviews('');
    }
    updateIdCardDemoText();

    // --- TUTORIAL LOGIC ---
    const tutorialSteps = [
        {
            id: 'intro',
            title: 'Witaj w poradniku',
            message: 'Pokażę Ci najważniejsze miejsca na stronie. Dymek będzie pojawiał się przy elemencie, którego dotyczy opis.',
            nextLabel: 'Tak, zacznij',
            showSkip: true
        },
        {
            id: 'mode',
            title: 'Tryb działania',
            message: 'Ten pasek pokazuje aktywny tryb. All-in-One składa dokumenty w jedną płynną aplikację, a tryb zwykły zostawia je jako oddzielne pliki.',
            target: 'mode-banner',
            targetHint: 'Podświetlam aktywny tryb na stronie.',
            nextLabel: 'Gdzie zmienić tryb',
            closeForm: true
        },
        {
            id: 'mode-toggle',
            title: 'Zmiana trybu w profilu',
            message: 'Kliknięcie „Profil / Dokument" otwiera profil. Tam wybierzesz między All-in-One a trybem zwykłym i ponownie uruchomisz ten samouczek, kiedy zechcesz.',
            target: 'profile-link',
            targetHint: 'Tutaj zmienisz tryb i zarządzasz dokumentem.',
            nextLabel: 'Pokaż dokumenty',
            closeForm: true
        },
        {
            id: 'open-document-action',
            title: 'Przejdź do dokumentu',
            message: 'W trybie zwykłym ten przycisk otwiera zapisany dokument od razu na ekranie logowania. W trybie All-in-One najpierw pokaże wybór dokumentów do połączenia.',
            target: 'open-document-action',
            targetHint: 'Ten przycisk reaguje inaczej zależnie od aktywnego trybu.',
            nextLabel: 'Pokaż mDowód',
            closeForm: true
        },
        {
            id: 'choose-mdowod',
            title: 'Wybierz mDowód',
            message: 'Najpierw otwórz kartę mDowód. To ona prowadzi do głównego formularza i podglądu danych.',
            target: 'mdowod-card',
            targetHint: 'Kliknięcie tej karty otwiera formularz mDowodu.',
            nextLabel: 'Przejdź do formularza',
            closeForm: true,
            beforeShow: function () {
                selectTutorialTemplate('new_mdowod');
            }
        },
        {
            id: 'photo',
            title: 'Zdjęcie',
            message: 'Tutaj wgrywasz zdjęcie. Po wyborze pliku zobaczysz podgląd oraz miniaturę na demo dokumentu.',
            target: 'photo-upload',
            targetHint: 'To pole odpowiada za zdjęcie i jego podgląd.',
            nextLabel: 'Dalej',
            openForm: true,
            scrollDelay: 360,
            beforeShow: function () {
                selectTutorialTemplate('new_mdowod');
            }
        },
        {
            id: 'demo',
            title: 'Demo na dokumencie',
            message: 'Ten panel pokazuje, jak wpisane dane i zdjęcie wyglądają w układzie dokumentu. Podgląd aktualizuje się podczas wpisywania.',
            target: 'document-demo',
            targetHint: 'Tu sprawdzasz efekt przed zapisem.',
            nextLabel: 'Dane osobowe',
            openForm: true,
            scrollDelay: 220
        },
        {
            id: 'gender',
            title: 'Najpierw wybierz płeć',
            message: 'Płeć jest potrzebna do losowania danych i generowania PESEL. Bez tego przyciski walidacyjne pokażą komunikat zamiast uzupełnić formularz.',
            target: 'gender',
            targetHint: 'Najpierw ustaw tę wartość.',
            nextLabel: 'Pokaż losowanie',
            openForm: true
        },
        {
            id: 'random',
            title: 'Imię, nazwisko i losowe dane',
            message: 'Po wybraniu płci możesz użyć przycisku Generuj losowe dane. Uzupełni on podstawowe pola, a podgląd dokumentu od razu pokaże nowe wartości.',
            target: 'random-data',
            targetHint: 'Ten przycisk automatycznie uzupełnia podstawowe dane.',
            nextLabel: 'PESEL i data',
            openForm: true
        },
        {
            id: 'birth-date',
            title: 'Data urodzenia',
            message: 'Data urodzenia jest używana razem z płcią do wygenerowania numeru PESEL. Jeśli losujesz dane, to pole zwykle zostanie uzupełnione automatycznie.',
            target: 'birth-date',
            targetHint: 'To pole wpływa na numer PESEL.',
            nextLabel: 'Pokaż PESEL',
            openForm: true
        },
        {
            id: 'pesel',
            title: 'PESEL',
            message: 'Tutaj możesz wpisać numer ręcznie albo wygenerować go automatycznie na podstawie daty urodzenia i płci.',
            target: 'pesel',
            targetHint: 'Przycisk obok pola generuje PESEL.',
            nextLabel: 'Zapis formularza',
            openForm: true
        },
        {
            id: 'save',
            title: 'Modyfikuj, zapisz i wyczyść',
            message: 'Na końcu zapisujesz zmiany przyciskiem Modyfikuj i Zapisz. Wyczyść formularz zeruje pola, gdy chcesz zacząć od nowa.',
            target: 'submit-actions',
            targetHint: 'Tutaj zapisujesz albo czyścisz formularz.',
            nextLabel: 'Wypełnię i zapiszę',
            openForm: true
        },
        {
            id: 'after-save',
            title: 'Gotowe',
            message: 'Dane zostały zapisane. Po zapisie możesz przejść do dokumentu albo wrócić do profilu, gdzie zmienisz tryb działania aplikacji.',
            nextLabel: 'Zakończ',
            showSkip: false
        }
    ];

    saveStepIndex = tutorialSteps.findIndex((step) => step.id === 'save');
    afterSaveStepIndex = tutorialSteps.findIndex((step) => step.id === 'after-save');

    window.showTutorialStep = showTutorialStep;

    function isTutorialStep(stepId) {
        return tutorialSteps[currentStep] && tutorialSteps[currentStep].id === stepId;
    }

    function showTutorialStepById(stepId) {
        const stepIndex = tutorialSteps.findIndex((step) => step.id === stepId);
        if (stepIndex >= 0) {
            showTutorialStep(stepIndex);
        }
    }

    function selectTutorialTemplate(value) {
        const radio = document.querySelector('input[name="template_version"][value="' + value + '"]');
        if (!radio) return;
        if (!radio.checked) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            updateTemplateFields();
        }
        document.querySelectorAll('[data-template-choice]').forEach((row) => {
            row.classList.toggle('is-selected', row.getAttribute('data-template-choice') === value);
        });
    }

    function setTutorialFormPanelOpen(open) {
        const panel = document.getElementById('documentFormPanel');
        if (!panel) return;
        document.body.classList.toggle('form-panel-open', Boolean(open));
        // Blur focused descendant before hiding — browsers block aria-hidden
        // on a subtree that retains focus (a11y compliance).
        if (!open && panel.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        panel.setAttribute('aria-hidden', open ? 'false' : 'true');
        const title = document.querySelector('[data-form-panel-title]');
        const selected = document.querySelector('input[name="template_version"]:checked');
        const row = selected ? selected.closest('[data-template-choice]') : null;
        const label = row ? row.querySelector('.version-label') : null;
        if (title && label) {
            title.textContent = label.textContent.trim();
        }
    }

    function clearTutorialHighlight() {
        document.querySelectorAll('.tutorial-focus-target').forEach((element) => {
            element.classList.remove('tutorial-focus-target');
        });
    }

    function getTutorialTarget(stepData) {
        if (!stepData.target) return null;
        return document.querySelector('[data-tutorial-target="' + stepData.target + '"]');
    }

    // Cel jest "użyteczny" tylko, gdy faktycznie zajmuje miejsce na ekranie.
    // Element ukryty (np. profile-link ma display:none w widoku pulpitu) zwraca
    // zerowy prostokąt — wtedy traktujemy krok jak bez celu (karta na środku),
    // zamiast przyklejać dymek do narożnika i podświetlać niewidzialny element.
    function isTutorialTargetVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width >= 1 && rect.height >= 1;
    }

    function getTutorialCounter(stepIndex, stepData) {
        if (stepData.id === 'after-save') return 'Zapisano';
        const visibleSteps = tutorialSteps.filter((step) => step.id !== 'after-save');
        const visibleIndex = visibleSteps.findIndex((step) => step.id === stepData.id);
        return visibleIndex >= 0 ? (visibleIndex + 1) + ' z ' + visibleSteps.length : '';
    }

    function clampTutorialPosition(value, min, max) {
        if (max < min) return min;
        return Math.max(min, Math.min(value, max));
    }

    function positionTutorialCard(target) {
        const modal = document.getElementById('tutorialModal');
        const content = modal ? modal.querySelector('.tutorial-content') : null;
        if (!modal || !content || modal.style.display === 'none') return;

        const cardRect = content.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        let top = Math.max(12, Math.round((viewportHeight - cardRect.height) / 2));
        let left = Math.max(12, Math.round((viewportWidth - cardRect.width) / 2));

        if (target) {
            const targetRect = target.getBoundingClientRect();
            // Cel ukryty (zerowy prostokąt) albo całkiem poza ekranem → zostaw
            // kartę wyśrodkowaną, nie doklejaj jej do krawędzi (12,12).
            const targetUsable =
                targetRect.width >= 1 && targetRect.height >= 1 &&
                targetRect.bottom > 0 && targetRect.top < viewportHeight;
            if (targetUsable) {
                const spaceAbove = targetRect.top;
                const preferAbove = spaceAbove > cardRect.height + 24;
                top = preferAbove ? targetRect.top - cardRect.height - 12 : targetRect.bottom + 12;
                left = targetRect.left + (targetRect.width / 2) - (cardRect.width / 2);
            }
        }

        content.style.setProperty('--tutorial-card-top', `${clampTutorialPosition(Math.round(top), 12, viewportHeight - cardRect.height - 12)}px`);
        content.style.setProperty('--tutorial-card-left', `${clampTutorialPosition(Math.round(left), 12, viewportWidth - cardRect.width - 12)}px`);
    }

    function repositionCurrentTutorialCard() {
        const modal = document.getElementById('tutorialModal');
        if (!modal || modal.style.display === 'none') return;
        const t = getTutorialTarget(tutorialSteps[currentStep] || {});
        positionTutorialCard(isTutorialTargetVisible(t) ? t : null);
    }

    function hideTutorialModal(clearHighlight = true) {
        const modal = document.getElementById('tutorialModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('is-guided');
        }
        document.body.classList.remove('tutorial-active');
        if (clearHighlight) {
            clearTutorialHighlight();
        }
    }

    function showTutorialStep(step) {
        const stepIndex = Number(step);
        const stepData = tutorialSteps[stepIndex];
        if (!stepData) return;

        currentStep = stepIndex;
        clearTutorialHighlight();

        if (typeof stepData.beforeShow === 'function') {
            stepData.beforeShow();
        }
        if (stepData.closeForm) {
            setTutorialFormPanelOpen(false);
        }
        if (stepData.openForm) {
            setTutorialFormPanelOpen(true);
        }

        const modal = document.getElementById('tutorialModal');
        const title = document.getElementById('tutorialTitle');
        const message = document.getElementById('tutorialMessage');
        const nextBtn = document.getElementById('tutorialBtnNext');
        const skipBtn = document.getElementById('tutorialBtnSkip');
        const counter = document.getElementById('tutorialStepCounter');
        const hint = document.getElementById('tutorialTargetHint');
        const target = getTutorialTarget(stepData);
        const targetVisible = isTutorialTargetVisible(target);

        if (!modal || !title || !message || !nextBtn || !skipBtn) return;

        title.textContent = stepData.title;
        message.innerHTML = stepData.message;
        nextBtn.textContent = stepData.nextLabel || 'Dalej';
        nextBtn.style.display = stepData.showNext === false ? 'none' : 'inline-flex';
        skipBtn.style.display = stepData.showSkip === false ? 'none' : 'inline-flex';
        if (counter) {
            counter.textContent = getTutorialCounter(stepIndex, stepData);
        }
        if (hint) {
            // Podpowiedź "podświetlam X" ma sens tylko, gdy faktycznie jest co
            // podświetlić — przy ukrytym celu (krok 3 na pulpicie) ją chowamy.
            const showHint = Boolean(stepData.targetHint) && targetVisible;
            hint.textContent = showHint ? stepData.targetHint : '';
            hint.style.display = showHint ? 'block' : 'none';
        }

        modal.classList.toggle('is-guided', targetVisible);
        document.body.classList.add('tutorial-active');

        modal.style.display = 'block';
        positionTutorialCard(targetVisible ? target : null);

        if (targetVisible) {
            target.classList.add('tutorial-focus-target');
            window.setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                window.setTimeout(() => positionTutorialCard(target), 420);
            }, stepData.scrollDelay || 180);
        }
    }

    function completeTutorial(andCloseModal = true) {
        tutorialCompleted = true;
        if (andCloseModal) {
            hideTutorialModal(true);
        }
        fetch('/api/complete-tutorial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').getAttribute('content') }
        }).catch(err => console.error("Błąd podczas kończenia samouczka:", err));
    }

    document.getElementById('tutorialBtnNext').addEventListener('click', () => {
        const stepData = tutorialSteps[currentStep];
        if (!stepData) return;
        if (stepData.id === 'save') {
            hideTutorialModal(true);
            return;
        }
        if (stepData.id === 'after-save') {
            completeTutorial(true);
            return;
        }
        showTutorialStep(currentStep + 1);
    });

    document.getElementById('tutorialBtnSkip').addEventListener('click', () => completeTutorial(true));
    document.getElementById('tutorial-dont-show-again').addEventListener('change', (e) => {
        if (e.target.checked) {
            completeTutorial(false);
        }
    });

    function startTutorialWhenReady() {
        if (tutorialCompleted) return;
        if (window.__emulatorChoiceOpen || document.body.classList.contains('emulator-choice-open')) {
            window.addEventListener('emulator-choice-closed', () => showTutorialStep(0), { once: true });
            return;
        }
        showTutorialStep(0);
    }

    startTutorialWhenReady();
    window.addEventListener('resize', repositionCurrentTutorialCard);
    document.addEventListener('scroll', repositionCurrentTutorialCard, { passive: true, capture: true });

    window.deleteAnnouncement = async function(announcementId) {
        if (!confirm('Czy na pewno chcesz usunąć to ogłoszenie?')) return;
        try {
            const response = await fetch('/api/announcements/delete/' + announcementId, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                }
            });
            const data = await response.json();
            if (data.success) {
                const el = document.getElementById('announcement-' + announcementId);
                if (el) el.remove();
            } else {
                showAlert(data.error || 'Nie udało się usunąć ogłoszenia.', 'error');
            }
        } catch (error) {
            console.error('Error deleting announcement:', error);
            showAlert('Błąd podczas usuwania ogłoszenia.', 'error');
        }
    };

    window.stopImpersonation = async function() {
        if (!confirm('Czy na pewno chcesz zakończyć impersonację i wrócić do swojego konta admina?')) return;

        try {
            const response = await fetch('/admin/api/impersonate/stop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                }
            });
            const data = await response.json();
            if (data.success) {
                showAlert('Impersonacja zakończona. Przekierowywanie do panelu admina...', 'success');
                window.location.href = '/admin';
            } else {
                showAlert(data.error, 'error');
            }
        } catch (error) {
            console.error('Error stopping impersonation:', error);
            showAlert('Błąd podczas kończenia impersonacji.', 'error');
        }
    };

    const stopImpersonationLink = document.getElementById('stopImpersonationLink');
    if (stopImpersonationLink) {
        stopImpersonationLink.addEventListener('click', function(event) {
            event.preventDefault();
            window.stopImpersonation();
        });
    }

    document.querySelectorAll('.delete-announcement-btn[data-announcement-id]').forEach((button) => {
        button.addEventListener('click', function() {
            window.deleteAnnouncement(this.dataset.announcementId);
        });
    });
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
        args.push(v);
    }
    const fn = (typeof window !== 'undefined') ? window[action] : undefined;
    if (typeof fn === 'function') {
        fn.apply(null, args);
    } else {
        console.warn('[CSP dispatcher] no global function:', action);
    }
});
