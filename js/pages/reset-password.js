// Reset Password page
import { supabase } from '../supabase.js';
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    resetForm: document.getElementById('resetForm'),
    successMessage: document.getElementById('successMessage'),
    errorMessage: document.getElementById('errorMessage'),
    resetPasswordForm: document.getElementById('resetPasswordForm'),
    newPassword: document.getElementById('newPassword'),
    confirmPassword: document.getElementById('confirmPassword'),
    showPasswords: document.getElementById('showPasswords'),
    submitBtn: document.getElementById('submitBtn'),
    strengthBar: document.getElementById('strengthBar'),
    strengthText: document.getElementById('strengthText')
};

// State
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const type = urlParams.get('type');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkToken();
    setupEventListeners();
});

// Check for valid token
function checkToken() {
    if (!token || !type) {
        showError('Invalid or missing reset token');
    }
}

// Setup event listeners
function setupEventListeners() {
    if (elements.resetPasswordForm) {
        elements.resetPasswordForm.addEventListener('submit', handleResetPassword);
    }

    if (elements.newPassword) {
        elements.newPassword.addEventListener('input', checkPasswordStrength);
    }

    if (elements.showPasswords) {
        elements.showPasswords.addEventListener('change', togglePasswordVisibility);
    }
}

// Handle password reset
async function handleResetPassword(e) {
    e.preventDefault();

    const newPassword = elements.newPassword?.value;
    const confirmPassword = elements.confirmPassword?.value;

    // Validate
    if (!newPassword || !confirmPassword) {
        notifications.error('Please fill in all fields');
        return;
    }

    if (newPassword.length < 8) {
        notifications.error('Password must be at least 8 characters');
        return;
    }

    if (newPassword !== confirmPassword) {
        notifications.error('Passwords do not match');
        return;
    }

    // Check password strength
    const strength = Utils.checkPasswordStrength(newPassword);
    if (strength.score < 2) {
        notifications.error('Password is too weak. Please use a stronger password.');
        return;
    }

    // Show loading
    setLoading(true);

    try {
        // Verify the OTP and update password
        const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type
        });

        if (error) throw error;

        // Update password
        const result = await api.updatePassword(newPassword);

        if (result.success) {
            // Show success
            if (elements.resetForm) {
                elements.resetForm.style.display = 'none';
            }
            if (elements.successMessage) {
                elements.successMessage.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        showError(error.message);
    } finally {
        setLoading(false);
    }
}

// Show error
function showError(message) {
    if (elements.resetForm) {
        elements.resetForm.style.display = 'none';
    }
    if (elements.errorMessage) {
        elements.errorMessage.style.display = 'block';
        const errorText = elements.errorMessage.querySelector('p');
        if (errorText) {
            errorText.textContent = message || 'The password reset link is invalid or has expired.';
        }
    }
}

// Check password strength
function checkPasswordStrength() {
    const password = elements.newPassword.value;
    const strength = Utils.checkPasswordStrength(password);

    // Update strength bar
    if (elements.strengthBar) {
        elements.strengthBar.className = 'strength-bar';

        if (password.length === 0) {
            elements.strengthBar.style.width = '0%';
            if (elements.strengthText) {
                elements.strengthText.textContent = 'Enter a password';
            }
        } else {
            const percentages = ['0%', '20%', '40%', '60%', '80%', '100%'];
            elements.strengthBar.style.width = percentages[strength.score];

            if (strength.score <= 2) {
                elements.strengthBar.classList.add('weak');
            } else if (strength.score <= 3) {
                elements.strengthBar.classList.add('medium');
            } else {
                elements.strengthBar.classList.add('strong');
            }

            if (elements.strengthText) {
                elements.strengthText.textContent = strength.strength;
            }
        }
    }
}

// Toggle password visibility
function togglePasswordVisibility() {
    const type = elements.showPasswords.checked ? 'text' : 'password';
    if (elements.newPassword) {
        elements.newPassword.type = type;
    }
    if (elements.confirmPassword) {
        elements.confirmPassword.type = type;
    }
}

// Set loading state
function setLoading(isLoading) {
    if (!elements.submitBtn) return;

    if (isLoading) {
        elements.submitBtn.disabled = true;
        elements.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
    } else {
        elements.submitBtn.disabled = false;
        elements.submitBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Reset Password';
    }
}