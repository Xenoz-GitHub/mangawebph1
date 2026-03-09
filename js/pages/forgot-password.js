// Forgot Password page
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    forgotForm: document.getElementById('forgotForm'),
    successMessage: document.getElementById('successMessage'),
    forgotPasswordForm: document.getElementById('forgotPasswordForm'),
    email: document.getElementById('email'),
    sentEmail: document.getElementById('sentEmail'),
    submitBtn: document.getElementById('submitBtn'),
    resendLink: document.getElementById('resendLink')
};

// State
let resendTimer = 60;
let timerInterval;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    if (elements.forgotPasswordForm) {
        elements.forgotPasswordForm.addEventListener('submit', sendResetLink);
    }

    if (elements.resendLink) {
        elements.resendLink.addEventListener('click', resendEmail);
    }
}

// Send reset link
async function sendResetLink(e) {
    e.preventDefault();

    const email = elements.email?.value.trim();

    if (!email) {
        notifications.error('Please enter your email address');
        return;
    }

    if (!Utils.isValidEmail(email)) {
        notifications.error('Please enter a valid email address');
        return;
    }

    // Show loading
    setLoading(true);

    try {
        const result = await api.resetPassword(email);

        if (result.success) {
            // Show success message
            if (elements.forgotForm) {
                elements.forgotForm.style.display = 'none';
            }
            if (elements.successMessage) {
                elements.successMessage.style.display = 'block';
            }
            if (elements.sentEmail) {
                elements.sentEmail.textContent = email;
            }

            // Start resend timer
            startResendTimer();
        }
    } catch (error) {
        console.error('Error sending reset link:', error);
    } finally {
        setLoading(false);
    }
}

// Resend email
async function resendEmail(e) {
    e.preventDefault();

    if (resendTimer > 0) return;

    const email = elements.sentEmail?.textContent;

    if (!email) return;

    try {
        if (elements.resendLink) {
            elements.resendLink.style.pointerEvents = 'none';
            elements.resendLink.textContent = 'Sending...';
        }

        const result = await api.resetPassword(email);

        if (result.success) {
            notifications.success('Reset link resent!');
            startResendTimer();
        }
    } catch (error) {
        console.error('Error resending:', error);
        notifications.error('Failed to resend. Please try again.');
        if (elements.resendLink) {
            elements.resendLink.style.pointerEvents = 'auto';
            elements.resendLink.textContent = 'Resend';
        }
    }
}

// Start resend timer
function startResendTimer() {
    resendTimer = 60;

    if (elements.resendLink) {
        elements.resendLink.style.pointerEvents = 'none';
        elements.resendLink.textContent = `Resend (${resendTimer}s)`;
    }

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        resendTimer--;

        if (resendTimer <= 0) {
            clearInterval(timerInterval);
            if (elements.resendLink) {
                elements.resendLink.style.pointerEvents = 'auto';
                elements.resendLink.textContent = 'Resend';
            }
        } else {
            if (elements.resendLink) {
                elements.resendLink.textContent = `Resend (${resendTimer}s)`;
            }
        }
    }, 1000);
}

// Set loading state
function setLoading(isLoading) {
    if (!elements.submitBtn) return;

    if (isLoading) {
        elements.submitBtn.disabled = true;
        elements.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    } else {
        elements.submitBtn.disabled = false;
        elements.submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link';
    }
}