// Maintenance page
import { supabase } from '../supabase.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';
import CONFIG from '../config.js';

// DOM Elements
const elements = {
    hours: document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),
    progressFill: document.querySelector('.progress-fill'),
    notifyEmail: document.getElementById('notifyEmail'),
    notifyBtn: document.querySelector('.notify-form button'),
    socialLinks: document.querySelectorAll('.social-link'),
    backLink: document.querySelector('.back-link')
};

// State
let countdownInterval;
let maintenanceEndTime = null;

// Maintenance schedule (in production, fetch from backend)
const MAINTENANCE_SCHEDULE = {
    start: new Date(), // Now
    end: new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000 + 15 * 1000) // 2h 30m 15s from now
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadMaintenanceData();
    setupEventListeners();
    startCountdown();
});

// Setup event listeners
function setupEventListeners() {
    // Notify form
    if (elements.notifyBtn) {
        elements.notifyBtn.addEventListener('click', handleNotifySubmit);
    }

    if (elements.notifyEmail) {
        elements.notifyEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleNotifySubmit();
            }
        });
    }

    // Social links tracking
    elements.socialLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            trackSocialClick(e.target.href);
        });
    });

    // Back link tracking
    if (elements.backLink) {
        elements.backLink.addEventListener('click', () => {
            trackBackClick();
        });
    }
}

// Load maintenance data from backend
async function loadMaintenanceData() {
    try {
        // In production, fetch actual maintenance schedule from database
        const { data, error } = await supabase
            .from('maintenance_schedule')
            .select('*')
            .eq('active', true)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error loading maintenance data:', error);
        }

        if (data) {
            // Update maintenance end time from database
            maintenanceEndTime = new Date(data.ends_at);
        } else {
            // Use default schedule
            maintenanceEndTime = MAINTENANCE_SCHEDULE.end;
        }

    } catch (error) {
        console.error('Error loading maintenance data:', error);
        // Fallback to default
        maintenanceEndTime = MAINTENANCE_SCHEDULE.end;
    }
}

// Start countdown timer
function startCountdown() {
    updateCountdown();

    // Update every second
    countdownInterval = setInterval(updateCountdown, 1000);
}

// Update countdown
function updateCountdown() {
    if (!maintenanceEndTime) return;

    const now = new Date();
    const diff = maintenanceEndTime - now;

    if (diff <= 0) {
        // Maintenance should be over
        clearInterval(countdownInterval);
        checkMaintenanceStatus();
        return;
    }

    // Calculate time units
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // Update display
    if (elements.hours) {
        elements.hours.textContent = hours.toString().padStart(2, '0');
    }
    if (elements.minutes) {
        elements.minutes.textContent = minutes.toString().padStart(2, '0');
    }
    if (elements.seconds) {
        elements.seconds.textContent = seconds.toString().padStart(2, '0');
    }

    // Update progress bar
    updateProgressBar(diff);
}

// Update progress bar
function updateProgressBar(remaining) {
    if (!elements.progressFill) return;

    const totalDuration = maintenanceEndTime - MAINTENANCE_SCHEDULE.start;
    const elapsed = totalDuration - remaining;
    const percentage = (elapsed / totalDuration) * 100;

    elements.progressFill.style.width = `${percentage}%`;
}

// Check if maintenance is still active
async function checkMaintenanceStatus() {
    try {
        // In production, check actual status
        const { data, error } = await supabase
            .from('system_status')
            .select('maintenance_mode')
            .single();

        if (error) throw error;

        if (!data?.maintenance_mode) {
            // Maintenance is over, redirect to home
            showMaintenanceEnded();
        } else {
            // Maintenance extended, reset timer
            resetTimer();
        }
    } catch (error) {
        console.error('Error checking maintenance status:', error);
        // Assume maintenance is still active
        resetTimer();
    }
}

// Reset timer (maintenance extended)
function resetTimer() {
    // Add 30 more minutes
    maintenanceEndTime = new Date(maintenanceEndTime.getTime() + 30 * 60 * 1000);
    
    notifications.info('Maintenance has been extended by 30 minutes');
    
    // Update progress bar
    updateProgressBar(maintenanceEndTime - new Date());
}

// Show maintenance ended message
function showMaintenanceEnded() {
    const container = document.querySelector('.maintenance-container');
    if (!container) return;

    container.innerHTML = `
        <div class="maintenance-ended">
            <i class="fas fa-check-circle" style="font-size: 5rem; color: #00b894; margin-bottom: 2rem;"></i>
            <h2>Maintenance Complete!</h2>
            <p>We're back online and better than ever!</p>
            <a href="../index.html" class="btn-primary" style="margin-top: 2rem;">
                <i class="fas fa-home"></i> Go to Home
            </a>
        </div>
    `;
}

// Handle notify form submit
async function handleNotifySubmit() {
    const email = elements.notifyEmail?.value.trim();

    if (!email) {
        notifications.error('Please enter your email address');
        return;
    }

    if (!Utils.isValidEmail(email)) {
        notifications.error('Please enter a valid email address');
        return;
    }

    // Show loading
    if (elements.notifyBtn) {
        elements.notifyBtn.disabled = true;
        elements.notifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        // Save to database
        const { error } = await supabase
            .from('maintenance_notifications')
            .insert([{
                email: email,
                notified: false,
                created_at: new Date().toISOString()
            }]);

        if (error) {
            if (error.code === '23505') { // Unique violation
                notifications.warning('This email is already registered for notifications');
            } else {
                throw error;
            }
        } else {
            notifications.success('You\'ll be notified when maintenance is complete!');
            if (elements.notifyEmail) {
                elements.notifyEmail.value = '';
            }
        }

    } catch (error) {
        console.error('Error saving notification email:', error);
        notifications.error('Failed to save email. Please try again.');
    } finally {
        // Reset button
        if (elements.notifyBtn) {
            elements.notifyBtn.disabled = false;
            elements.notifyBtn.innerHTML = 'Notify Me';
        }
    }
}

// Track social link clicks
function trackSocialClick(url) {
    try {
        // In production, send to analytics
        console.log('Social link clicked:', url);
        
        // You could also save to database
        supabase
            .from('analytics_events')
            .insert([{
                event_type: 'social_click',
                event_data: { url: url },
                created_at: new Date().toISOString()
            }])
            .then();
    } catch (error) {
        console.error('Error tracking social click:', error);
    }
}

// Track back link click
function trackBackClick() {
    try {
        supabase
            .from('analytics_events')
            .insert([{
                event_type: 'maintenance_back_click',
                created_at: new Date().toISOString()
            }])
            .then();
    } catch (error) {
        console.error('Error tracking back click:', error);
    }
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
});

// Ping server to check if maintenance is over
setInterval(async () => {
    try {
        const response = await fetch('/api/health', {
            method: 'HEAD',
            cache: 'no-cache'
        });

        if (response.ok) {
            // Server is responding, maintenance might be over
            checkMaintenanceStatus();
        }
    } catch (error) {
        // Server still down, ignore
        console.log('Maintenance still in progress');
    }
}, 30000); // Check every 30 seconds