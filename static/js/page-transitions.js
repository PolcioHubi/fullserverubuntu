/**
 * Page Transitions - płynne animacje przejść między stronami
 * Dodaje efekt fade out przy opuszczaniu strony i fade in przy wejściu
 */

(function() {
    'use strict';
    
    // Konfiguracja
    const TRANSITION_DURATION = 200; // ms
    const EXCLUDED_LINKS = [
        '[download]',
        '[target="_blank"]',
        '[href^="mailto:"]',
        '[href^="tel:"]',
        '[href^="javascript:"]',
        '[href^="#"]',
        '.no-transition'
    ];
    
    // Flaga czy animacja jest w toku
    let isTransitioning = false;
    
    /**
     * Inicjalizacja po załadowaniu DOM
     */
    function init() {
        // Animacja wejścia na stronę
        document.body.classList.add('page-loaded');
        
        // Obsługa kliknięć w linki
        document.addEventListener('click', handleLinkClick);
        
        // Obsługa nawigacji wstecz/wprzód
        window.addEventListener('pageshow', handlePageShow);
        
        // Obsługa formularzy (jeśli chcemy animację przy submit)
        document.addEventListener('submit', handleFormSubmit);
    }
    
    /**
     * Sprawdza czy link powinien mieć animację
     */
    function shouldAnimate(link) {
        // Sprawdź czy to wewnętrzny link
        if (!link.href || link.href === '' || link.href === '#') {
            return false;
        }
        
        // Sprawdź czy to ten sam origin
        try {
            const url = new URL(link.href);
            if (url.origin !== window.location.origin) {
                return false;
            }
        } catch (e) {
            return false;
        }
        
        // Sprawdź wykluczenia
        for (const selector of EXCLUDED_LINKS) {
            if (link.matches(selector)) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Obsługa kliknięcia w link
     */
    function handleLinkClick(e) {
        const link = e.target.closest('a');
        
        if (!link || !shouldAnimate(link) || isTransitioning) {
            return;
        }
        
        // Sprawdź czy nie jest to specjalne kliknięcie (ctrl+click, cmd+click)
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
            return;
        }
        
        e.preventDefault();
        navigateWithTransition(link.href);
    }
    
    /**
     * Obsługa submit formularza
     */
    function handleFormSubmit(e) {
        const form = e.target;
        
        // Tylko dla formularzy bez target lub z pustym action
        if (form.target === '_blank' || form.classList.contains('no-transition')) {
            return;
        }
        
        // Dodaj klasę przejścia
        document.body.classList.add('page-transitioning');
    }
    
    /**
     * Nawigacja z animacją
     */
    function navigateWithTransition(url) {
        isTransitioning = true;
        
        // Fade out
        document.body.classList.add('page-transitioning');
        
        // Po animacji - przejdź do nowej strony
        setTimeout(function() {
            window.location.href = url;
        }, TRANSITION_DURATION);
    }
    
    /**
     * Obsługa pageshow (nawigacja wstecz/wprzód)
     */
    function handlePageShow(e) {
        // Jeśli strona z cache (bfcache)
        if (e.persisted) {
            document.body.classList.remove('page-transitioning');
            document.body.classList.add('page-loaded');
            isTransitioning = false;
        }
    }
    
    /**
     * Publiczne API do programowej nawigacji z animacją
     */
    window.navigateWithTransition = navigateWithTransition;
    
    // Inicjalizacja gdy DOM gotowy
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
