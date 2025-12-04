// public/login/validation.js
(() => {
    const form = document.getElementById('form');
    const usernameEl = document.getElementById('username');
    const passwordEl = document.getElementById('password-input');
    const repeatPasswordEl = document.getElementById('repeat-password-input'); // nur vorhanden bei signup
    const errorMessageEl = document.getElementById('error-message');
    const submitBtn = document.getElementById('submitBtn');
    const usernameAvailabilityEl = document.getElementById('username-availability'); // nur signup

    if (!form) return;

    // debounce helper
    function debounce(fn, ms = 300) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    }

    function showError(msg) {
        errorMessageEl.innerText = msg || '';
        errorMessageEl.style.color = msg ? '#b91c1c' : '';
    }

    function clearFieldErrors() {
        [usernameEl, passwordEl, repeatPasswordEl].forEach(el => {
            if (!el) return;
            el.parentElement.classList.remove('incorrect');
        });
    }

    function getSignupErrors(username, password, repeat) {
        const errs = [];
        if (!username) errs.push('Benutzername fehlt');
        if (!password) errs.push('Passwort fehlt');
        if (password && password.length < 6) errs.push('Passwort muss mindestens 6 Zeichen lang sein');
        if (password !== repeat) errs.push('Passwörter stimmen nicht überein');
        return errs;
    }

    function getLoginErrors(username, password) {
        const errs = [];
        if (!username) errs.push('Benutzername fehlt');
        if (!password) errs.push('Passwort fehlt');
        return errs;
    }

    async function postJson(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || j.message || res.statusText || 'Serverfehler');
        return j;
    }

    // Check username availability (signup)
    async function checkUsernameAvailability(name) {
        if (!name) {
            usernameAvailabilityEl.textContent = '';
            return null;
        }
        try {
            const q = new URLSearchParams({ username: name }).toString();
            const res = await fetch('/api/check_username?' + q);
            const j = await res.json();
            if (res.ok && j && typeof j.available === 'boolean') {
                usernameAvailabilityEl.style.color = j.available ? '#065f46' : '#b91c1c';
                usernameAvailabilityEl.textContent = j.available ? 'Benutzername verfügbar' : 'Benutzername bereits vergeben';
                return j.available;
            } else {
                usernameAvailabilityEl.style.color = '#6b7280';
                usernameAvailabilityEl.textContent = 'Verfügbarkeit unbekannt';
                return null;
            }
        } catch (e) {
            usernameAvailabilityEl.style.color = '#6b7280';
            usernameAvailabilityEl.textContent = 'Fehler beim Prüfen';
            return null;
        }
    }

    const debouncedCheck = debounce((val) => {
        checkUsernameAvailability(val);
    }, 400);

    if (usernameEl && usernameAvailabilityEl) {
        usernameEl.addEventListener('input', (e) => {
            usernameAvailabilityEl.textContent = '';
            debouncedCheck(e.target.value.trim().toLowerCase());
        });
        usernameEl.addEventListener('blur', (e) => {
            checkUsernameAvailability(e.target.value.trim().toLowerCase());
        });
    }

    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        clearFieldErrors();
        showError('');

        const username = usernameEl ? usernameEl.value.trim().toLowerCase() : '';
        const password = passwordEl ? passwordEl.value : '';
        const repeat = repeatPasswordEl ? repeatPasswordEl.value : null;
        const isSignup = !!repeatPasswordEl;

        const errors = isSignup ? getSignupErrors(username, password, repeat) : getLoginErrors(username, password);
        if (errors.length) {
            showError(errors.join('. '));
            if (errors.some(e => /Benutzername/i.test(e)) && usernameEl) usernameEl.parentElement.classList.add('incorrect');
            if (errors.some(e => /Passwort/i.test(e)) && passwordEl) passwordEl.parentElement.classList.add('incorrect');
            if (errors.some(e => /überein/i.test(e)) && repeatPasswordEl) repeatPasswordEl.parentElement.classList.add('incorrect');
            return;
        }

        // if signup -> ensure username is available before sending registration
        if (isSignup) {
            try {
                const avail = await checkUsernameAvailability(username);
                if (avail === false) {
                    showError('Dieser Benutzername ist bereits vergeben. Wähle einen anderen.');
                    usernameEl.parentElement.classList.add('incorrect');
                    return;
                }
            } catch (e) {
                // allow proceed on uncertain availability? better block to be safe
                showError('Fehler beim Prüfen des Benutzernamens. Versuche es erneut.');
                return;
            }
        }

        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = isSignup ? 'Registriere...' : 'Anmelden...';

        try {
            let resp;
            if (isSignup) {
                resp = await postJson('/api/signup', { username, password });
            } else {
                resp = await postJson('/api/login', { username, password });
            }
            if (!resp || !resp.token) throw new Error('Ungültige Server-Antwort');

            // Persist session for the chat UI
            localStorage.setItem('schoolChat_session_v1', JSON.stringify({
                token: resp.token,
                id: resp.id,
                username: resp.username,
                nick: resp.nick || resp.username
            }));

            // Weiterleitung zur Hauptseite
            window.location.href = '/';
        } catch (err) {
            showError(err.message || 'Fehler beim Authentifizieren');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });

    // remove inline error when typing
    [usernameEl, passwordEl, repeatPasswordEl].forEach(el => {
        if (!el) return;
        el.addEventListener('input', () => {
            el.parentElement.classList.remove('incorrect');
            if (errorMessageEl.textContent) showError('');
        });
    });
})();
