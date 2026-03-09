// Sign Up page
import { supabase } from '../supabase.js';
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    signupForm: document.getElementById('signupForm'),
    username: document.getElementById('username'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    confirmPassword: document.getElementById('confirmPassword'),
    terms: document.getElementById('terms'),
    submitBtn: document.querySelector('.auth-button'),
    strengthBar: document.getElementById('strengthBar'),
    strengthText: document.getElementById('strengthText'),
    usernameSuggestions: document.getElementById('usernameSuggestions'),
    socialButtons: document.querySelectorAll('.social-btn')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    if (elements.signupForm) {
        elements.signupForm.addEventListener('submit', handleSignUp);
    }

    if (elements.password) {
        elements.password.addEventListener('input', checkPasswordStrength);
    }

    if (elements.username) {
        elements.username.addEventListener('input', Utils.debounce(checkUsername, 500));
    }

    elements.socialButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const provider = btn.textContent.trim().toLowerCase();
            socialSignUp(provider);
        });
    });
}

// Handle sign up
async function handleSignUp(e) {
    e.preventDefault();

    // Get form values
    const username = elements.username?.value.trim();
    const email = elements.email?.value.trim();
    const password = elements.password?.value;
    const confirmPassword = elements.confirmPassword?.value;
    const termsAccepted = elements.terms?.checked;

    // Validate
    if (!username || !email || !password || !confirmPassword) {
        notifications.error('Please fill in all fields');
        return;
    }

    if (username.length < 3) {
        notifications.error('Username must be at least 3 characters');
        return;
    }

    if (!Utils.isValidEmail(email)) {
        notifications.error('Please enter a valid email address');
        return;
    }

    if (password.length < 8) {
        notifications.error('Password must be at least 8 characters');
        return;
    }

    if (password !== confirmPassword) {
        notifications.error('Passwords do not match');
        return;
    }

    if (!termsAccepted) {
        notifications.error('You must accept the Terms of Service');
        return;
    }

    // Check password strength
    const strength = Utils.checkPasswordStrength(password);
    if (strength.score < 2) {
        notifications.error('Password is too weak. Please use a stronger password.');
        return;
    }

    // Show loading
    setLoading(true);

    try {
        const result = await api.signUp(email, password, {
            username: username,
            full_name: username
        });

        if (result.success) {
            // Store email for verification page
            localStorage.setItem('pendingVerification', email);

            notifications.success('Account created! Please check your email for verification.');

            // Redirect to verification page
            setTimeout(() => {
                window.location.href = `verify-email.html?email=${encodeURIComponent(email)}`;
            }, 2000);
        }
    } catch (error) {
        console.error('Sign up error:', error);
    } finally {
        setLoading(false);
    }
}

// Check password strength
function checkPasswordStrength() {
    const password = elements.password.value;
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

// Check username availability
async function checkUsername() {
    const username = elements.username?.value.trim();

    if (username.length < 3) {
        if (elements.usernameSuggestions) {
            elements.usernameSuggestions.innerHTML = '';
        }
        return;
    }

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .eq('username', username)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            // Username taken, show suggestions
            showUsernameSuggestions(username);
        } else {
            // Username available
            if (elements.usernameSuggestions) {
                elements.usernameSuggestions.innerHTML = `
                    <span class="username-available">
                        <i class="fas fa-check-circle"></i> Username available
                    </span>
                `;
            }
        }
    } catch (error) {
        console.error('Error checking username:', error);
    }
}

// Show username suggestions
function showUsernameSuggestions(base) {
    const suggestions = [
        base + '_manga',
        base + 'fan',
        'manga_' + base,
        'reader_' + base,
        base + Utils.generateId().slice(0, 4)
    ];

    if (elements.usernameSuggestions) {
        elements.usernameSuggestions.innerHTML = suggestions.map(s => `
            <span class="username-suggestion" onclick="setUsername('${s}')">
                ${s}
            </span>
        `).join('');
    }
}

// Set username from suggestion
window.setUsername = function(username) {
    if (elements.username) {
        elements.username.value = username;
        checkUsername();
    }
};

// Social sign up
async function socialSignUp(provider) {
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
        console.error('Social sign up error:', error);
        notifications.error(`Failed to sign up with ${provider}`);
        setLoading(false);
    }
}

// Set loading state
function setLoading(isLoading) {
    if (!elements.submitBtn) return;

    if (isLoading) {
        elements.submitBtn.disabled = true;
        elements.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
    } else {
        elements.submitBtn.disabled = false;
        elements.submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
    }

    elements.socialButtons.forEach(btn => {
        btn.disabled = isLoading;
    });
}