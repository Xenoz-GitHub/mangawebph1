// Sign In page
import { supabase } from '../supabase.js';
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    signinForm: document.getElementById('signinForm'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    rememberMe: document.getElementById('rememberMe'),
    submitBtn: document.querySelector('.auth-button'),
    socialButtons: document.querySelectorAll('.social-btn')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkSavedCredentials();
});

// Setup event listeners
function setupEventListeners() {
    if (elements.signinForm) {
        elements.signinForm.addEventListener('submit', handleSignIn);
    }

    elements.socialButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const provider = btn.textContent.trim().toLowerCase();
            socialSignIn(provider);
        });
    });
}

// Check for saved credentials
function checkSavedCredentials() {
    const savedEmail = localStorage.getItem('savedEmail');
    const savedPassword = localStorage.getItem('savedPassword');

    if (savedEmail && elements.rememberMe?.checked) {
        if (elements.email) elements.email.value = savedEmail;
        if (elements.password) elements.password.value = savedPassword;
    }
}

// Handle sign in
async function handleSignIn(e) {
    e.preventDefault();

    const email = elements.email?.value.trim();
    const password = elements.password?.value;
    const rememberMe = elements.rememberMe?.checked;

    // Validate
    if (!email || !password) {
        notifications.error('Please fill in all fields');
        return;
    }

    if (!Utils.isValidEmail(email)) {
        notifications.error('Please enter a valid email address');
        return;
    }

    // Show loading
    setLoading(true);

    try {
        const result = await api.signIn(email, password);

        if (result.success) {
            // Save credentials if remember me is checked
            if (rememberMe) {
                localStorage.setItem('savedEmail', email);
                localStorage.setItem('savedPassword', password);
            } else {
                localStorage.removeItem('savedEmail');
                localStorage.removeItem('savedPassword');
            }

            // Redirect to home or previous page
            const redirectTo = new URLSearchParams(window.location.search).get('redirect') || '../index.html';
            window.location.href = redirectTo;
        }
    } catch (error) {
        console.error('Sign in error:', error);
    } finally {
        setLoading(false);
    }
}

// Social sign in
async function socialSignIn(provider) {
    try {
        setLoading(true);

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) throw error;

    } catch (error) {
        console.error('Social sign in error:', error);
        notifications.error(`Failed to sign in with ${provider}`);
        setLoading(false);
    }
}

// Set loading state
function setLoading(isLoading) {
    if (!elements.submitBtn) return;

    if (isLoading) {
        elements.submitBtn.disabled = true;
        elements.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
    } else {
        elements.submitBtn.disabled = false;
        elements.submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }

    elements.socialButtons.forEach(btn => {
        btn.disabled = isLoading;
    });
}

// Toggle password visibility
window.togglePassword = function() {
    const passwordInput = elements.password;
    const toggleIcon = document.querySelector('.toggle-password i');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        toggleIcon.className = 'fas fa-eye';
    }
};