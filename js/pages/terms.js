// Terms of Service page
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    tocLinks: document.querySelectorAll('.toc a'),
    lastUpdated: document.querySelector('.last-updated'),
    acceptBtn: document.getElementById('acceptTerms'),
    declineBtn: document.getElementById('declineTerms')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateLastUpdated();
    checkAcceptance();
});

// Setup event listeners
function setupEventListeners() {
    // Smooth scroll for TOC links
    elements.tocLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 100;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Accept terms button
    if (elements.acceptBtn) {
        elements.acceptBtn.addEventListener('click', acceptTerms);
    }

    // Decline terms button
    if (elements.declineBtn) {
        elements.declineBtn.addEventListener('click', declineTerms);
    }
}

// Update last updated date
function updateLastUpdated() {
    if (elements.lastUpdated) {
        const date = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        elements.lastUpdated.textContent = `Last Updated: ${date.toLocaleDateString('en-US', options)}`;
    }
}

// Check if user has accepted terms
function checkAcceptance() {
    const accepted = localStorage.getItem('termsAccepted');
    const acceptedVersion = localStorage.getItem('termsVersion');

    // Show accept buttons if not accepted or version changed
    if (!accepted || acceptedVersion !== '1.0') {
        showAcceptanceDialog();
    }
}

// Show acceptance dialog
function showAcceptanceDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'terms-dialog';
    dialog.innerHTML = `
        <div class="terms-dialog-content">
            <h3>Terms of Service Update</h3>
            <p>We've updated our Terms of Service. Please review and accept to continue using MangaWebPH.</p>
            <div class="terms-dialog-actions">
                <button class="btn-primary" id="acceptTerms">Accept</button>
                <button class="btn-secondary" id="declineTerms">Decline</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    // Add event listeners to new buttons
    document.getElementById('acceptTerms').addEventListener('click', acceptTerms);
    document.getElementById('declineTerms').addEventListener('click', declineTerms);
}

// Accept terms
function acceptTerms() {
    localStorage.setItem('termsAccepted', 'true');
    localStorage.setItem('termsVersion', '1.0');
    localStorage.setItem('termsAcceptedDate', new Date().toISOString());

    // Remove dialog if present
    const dialog = document.querySelector('.terms-dialog');
    if (dialog) {
        dialog.remove();
    }

    notifications.success('Thank you for accepting our Terms of Service');
}

// Decline terms
function declineTerms() {
    if (confirm('You must accept the Terms of Service to use MangaWebPH. Are you sure you want to decline?')) {
        window.location.href = '../index.html';
    }
}