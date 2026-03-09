// Verify Email page
import { supabase } from '../supabase.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    pendingCard: document.getElementById('pendingCard'),
    successCard: document.getElementById('successCard'),
    errorCard: document.getElementById('errorCard'),
    userEmail: document.getElementById('userEmail'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    resendBtn: document.getElementById('resendBtn'),
    resendLink: document.getElementById('resendLink'),
    checkBtn: document.querySelector('.btn-secondary')
};

// State
const urlParams = new URLSearchParams(window.location.search);
const email = urlParams.get('email') || localStorage.getItem('pendingVerification');
const token = urlParams.get('token');
const type = urlParams.get('type');

let progressInterval;
let progress = 0;
let resendTimer = 60;
let timerInterval;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (token && type) {
        // User clicked email link
        verifyEmail();
    } else if (email) {
        // Just arrived at page
        showPending();
    } else {
        // No email or token
        showError();
    }

    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    if (elements.checkBtn) {
        elements.checkBtn.addEventListener('click', checkVerification);
    }

    if (elements.resendBtn) {
        elements.resendBtn.addEventListener('click', resendVerification);
    }

    if (elements.resendLink) {
        elements.resendLink.addEventListener('click', resendVerification);
    }
}

// Show pending verification
function showPending() {
    if (elements.pendingCard) {
        elements.pendingCard.style.display = 'block';
    }
    if (elements.successCard) {
        elements.successCard.style.display = 'none';
    }
    if (elements.errorCard) {
        elements.errorCard.style.display = 'none';
    }
    if (elements.userEmail) {
        elements.userEmail.textContent = email;
    }

    startProgressSimulation();
}

// Show success
function showSuccess() {
    if (elements.pendingCard) {
        elements.pendingCard.style.display = 'none';
    }
    if (elements.successCard) {
        elements.successCard.style.display = 'block';
    }
    if (elements.errorCard) {
        elements.errorCard.style.display = 'none';
    }

    // Clear pending email
    localStorage.removeItem('pendingVerification');

    // Clear intervals
    if (progressInterval) clearInterval(progressInterval);
    if (timerInterval) clearInterval(timerInterval);
}

// Show error
function showError() {
    if (elements.pendingCard) {
        elements.pendingCard.style.display = 'none';
    }
    if (elements.successCard) {
        elements.successCard.style.display = 'none';
    }
    if (elements.errorCard) {
        elements.errorCard.style.display = 'block';
    }

    // Clear intervals
    if (progressInterval) clearInterval(progressInterval);
    if (timerInterval) clearInterval(timerInterval);
}

// Verify email
async function verifyEmail() {
    try {
        const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type
        });

        if (error) throw error;

        showSuccess();
        notifications.success('Email verified successfully!');

    } catch (error) {
        console.error('Error verifying email:', error);
        showError();
    }
}

// Check verification status
async function checkVerification() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) throw error;

        if (user?.email_confirmed_at) {
            showSuccess();
        } else {
            notifications.info('Email not verified yet. Please check your inbox.');
        }
    } catch (error) {
        console.error('Error checking verification:', error);
    }
}

// Resend verification email
async function resendVerification() {
    if (resendTimer < 60 && resendTimer > 0) {
        notifications.warning(`Please wait ${resendTimer} seconds before resending`);
        return;
    }

    if (!email) return;

    try {
        setResendLoading(true);

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email
        });

        if (error) throw error;

        notifications.success('Verification email sent!');
        startResendTimer();
        resetProgress();

    } catch (error) {
        console.error('Error resending:', error);
        notifications.error('Failed to resend email');
    } finally {
        setResendLoading(false);
    }
}

// Start progress simulation
function startProgressSimulation() {
    progress = 0;

    if (elements.progressFill) {
        elements.progressFill.style.width = '0%';
    }

    progressInterval = setInterval(() => {
        progress += 1;

        if (elements.progressFill) {
            elements.progressFill.style.width = progress + '%';
        }

        if (elements.progressText) {
            if (progress < 30) {
                elements.progressText.textContent = 'Waiting for verification...';
            } else if (progress < 60) {
                elements.progressText.textContent = 'Still waiting... Did you click the link?';
            } else if (progress < 90) {
                elements.progressText.textContent = 'Almost there! Check your email.';
            } else {
                elements.progressText.textContent = 'Taking longer than expected? Try resending.';
            }
        }

        if (progress >= 100) {
            clearInterval(progressInterval);
        }
    }, 1000);
}

// Reset progress
function resetProgress() {
    if (progressInterval) {
        clearInterval(progressInterval);
    }
    startProgressSimulation();
}

// Start resend timer
function startResendTimer() {
    resendTimer = 60;

    if (elements.resendBtn) {
        elements.resendBtn.disabled = true;
        elements.resendBtn.innerHTML = `<i class="fas fa-hourglass-half"></i> Resend (${resendTimer}s)`;
    }

    if (elements.resendLink) {
        elements.resendLink.style.pointerEvents = 'none';
        elements.resendLink.textContent = `Resend (${resendTimer}s)`;
    }

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        resendTimer--;

        if (resendTimer <= 0) {
            clearInterval(timerInterval);
            if (elements.resendBtn) {
                elements.resendBtn.disabled = false;
                elements.resendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Resend Email';
            }
            if (elements.resendLink) {
                elements.resendLink.style.pointerEvents = 'auto';
                elements.resendLink.textContent = 'click here to resend';
            }
        } else {
            if (elements.resendBtn) {
                elements.resendBtn.innerHTML = `<i class="fas fa-hourglass-half"></i> Resend (${resendTimer}s)`;
            }
            if (elements.resendLink) {
                elements.resendLink.textContent = `Resend (${resendTimer}s)`;
            }
        }
    }, 1000);
}

// Set resend loading state
function setResendLoading(isLoading) {
    if (elements.resendBtn) {
        elements.resendBtn.disabled = isLoading;
        if (isLoading) {
            elements.resendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        }
    }
    if (elements.resendLink) {
        elements.resendLink.style.pointerEvents = isLoading ? 'none' : 'auto';
    }
}