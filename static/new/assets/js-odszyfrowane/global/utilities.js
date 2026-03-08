const utilities = {
    openUrl(url, newWindow = true) {
        if (newWindow) {
            window.open(url, '_blank');
            return;
        }
        window.location.href = url;
    },

    setClipboard(text) {
        navigator.clipboard.writeText(text)
    }
}

const debug = {
    log(message, type) {
        switch (type) {
            case "info":
                console.info(`[DEBUG]`, message);
                break;
            case "warning":
                console.warn(`[DEBUG]`, message);
                break;
            case "error":
                console.error(`[DEBUG]`, message);
                break;
            default:
                console.log(`[DEBUG]`, message);
                break;
        }
    }
}