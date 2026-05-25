(function () {
    "use strict";

    function csrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute("content") : "";
    }

    function initTutorialReset() {
        const button = document.getElementById("profileResetTutorial");
        if (!button) {
            return;
        }

        const message = button.querySelector("[data-reset-tutorial-message]");

        button.addEventListener("click", async function () {
            button.disabled = true;
            button.classList.remove("is-error");
            if (message) {
                message.textContent = "Uruchamianie samouczka...";
            }

            try {
                const response = await fetch("/api/reset-tutorial", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrfToken()
                    },
                    body: "{}"
                });
                const data = await response.json().catch(() => ({}));

                if (!response.ok || !data.success) {
                    throw new Error(data.error || "Nie udało się zresetować samouczka.");
                }

                window.location.href = "/?tutorial=1";
            } catch (error) {
                console.error("Nie udało się uruchomić samouczka ponownie:", error);
                button.disabled = false;
                button.classList.add("is-error");
                if (message) {
                    message.textContent = "Nie udało się uruchomić samouczka. Spróbuj ponownie.";
                }
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initTutorialReset);
    } else {
        initTutorialReset();
    }
})();
