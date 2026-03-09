// Premium page
import { supabase, getCurrentUser, onAuthChange } from '../supabase.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    pricingCards: document.querySelectorAll('.pricing-card'),
    premiumBadge: document.querySelector('.premium-badge'),
    faqItems: document.querySelectorAll('.faq-item'),
    comparisonTable: document.querySelector('.comparison-table')
};

// State
let currentUser = getCurrentUser();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadUserPremiumStatus();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Pricing buttons
    elements.pricingCards.forEach(card => {
        const btn = card.querySelector('.pricing-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                const plan = card.querySelector('.pricing-name')?.textContent.toLowerCase();
                selectPlan(plan);
            });
        }
    });

    // FAQ items (for accordion if needed)
    elements.faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', () => {
                item.classList.toggle('active');
            });
        }
    });
}

// Load user premium status
async function loadUserPremiumStatus() {
    if (!currentUser) return;

    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('is_premium, premium_expires_at, premium_type')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;

        if (profile?.is_premium) {
            updateUIPremium(profile);
        }

    } catch (error) {
        console.error('Error loading premium status:', error);
    }
}

// Update UI for premium users
function updateUIPremium(profile) {
    // Update premium badge
    if (elements.premiumBadge) {
        elements.premiumBadge.innerHTML = `
            <i class="fas fa-crown"></i> 
            Premium Active (${profile.premium_type || 'Monthly'})
        `;
    }

    // Disable pricing buttons for premium users
    elements.pricingCards.forEach(card => {
        const btn = card.querySelector('.pricing-btn');
        if (btn) {
            btn.textContent = 'Current Plan';
            btn.disabled = true;
        }
    });
}

// Select plan
function selectPlan(plan) {
    if (!currentUser) {
        notifications.warning('Please sign in to purchase premium');
        window.location.href = 'signin.html';
        return;
    }

    // Check if already premium
    if (document.querySelector('.premium-badge')?.textContent.includes('Premium Active')) {
        notifications.info('You are already a premium member');
        return;
    }

    // Redirect to payment page
    window.location.href = `payment.html?plan=${plan}`;
}

// Initialize payment (called from payment page)
window.initiatePayment = async function(plan, paymentMethod) {
    try {
        // Show loading
        notifications.info('Processing payment...');

        // In production, integrate with GCash/PayPal API
        // This is a placeholder for the actual payment processing
        const paymentResult = await processPayment(plan, paymentMethod);

        if (paymentResult.success) {
            // Update user premium status
            const { error } = await supabase
                .from('profiles')
                .update({
                    is_premium: true,
                    premium_type: plan,
                    premium_expires_at: calculateExpiry(plan)
                })
                .eq('id', currentUser.id);

            if (error) throw error;

            // Track purchase
            await supabase.from('premium_purchases').insert([{
                user_id: currentUser.id,
                plan: plan,
                amount: getPlanPrice(plan),
                payment_method: paymentMethod,
                created_at: new Date().toISOString()
            }]);

            notifications.success('Welcome to Premium!');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        }

    } catch (error) {
        console.error('Payment error:', error);
        notifications.error('Payment failed. Please try again.');
    }
};

// Process payment (placeholder - replace with actual payment gateway)
async function processPayment(plan, paymentMethod) {
    // Simulate payment processing
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ success: true });
        }, 2000);
    });
}

// Calculate expiry date based on plan
function calculateExpiry(plan) {
    const date = new Date();
    switch(plan) {
        case 'basic':
            date.setMonth(date.getMonth() + 1);
            break;
        case 'pro':
            date.setMonth(date.getMonth() + 1);
            break;
        case 'ultimate':
            date.setMonth(date.getMonth() + 1);
            break;
        default:
            date.setMonth(date.getMonth() + 1);
    }
    return date.toISOString();
}

// Get plan price
function getPlanPrice(plan) {
    const prices = {
        'basic': 99,
        'pro': 199,
        'ultimate': 399
    };
    return prices[plan] || 0;
}

// Apply promo code
window.applyPromoCode = async function(code) {
    try {
        const { data, error } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('code', code)
            .eq('active', true)
            .single();

        if (error) throw error;

        if (data) {
            notifications.success(`Promo applied! ${data.discount}% off`);
            return data.discount;
        } else {
            notifications.error('Invalid promo code');
            return 0;
        }
    } catch (error) {
        console.error('Error applying promo:', error);
        notifications.error('Failed to apply promo code');
        return 0;
    }
};