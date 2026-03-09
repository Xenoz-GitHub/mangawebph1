// Privacy Policy page
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    tocLinks: document.querySelectorAll('.toc a'),
    lastUpdated: document.querySelector('.last-updated')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateLastUpdated();
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

    // Highlight current section on scroll
    window.addEventListener('scroll', Utils.throttle(highlightCurrentSection, 100));
}

// Update last updated date
function updateLastUpdated() {
    if (elements.lastUpdated) {
        const date = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        elements.lastUpdated.textContent = `Last Updated: ${date.toLocaleDateString('en-US', options)}`;
    }
}

// Highlight current section in TOC
function highlightCurrentSection() {
    const sections = document.querySelectorAll('section[id]');
    const scrollPosition = window.scrollY + 120;

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionBottom = sectionTop + section.offsetHeight;
        const id = section.getAttribute('id');

        if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
            // Remove active class from all TOC links
            elements.tocLinks.forEach(link => {
                link.classList.remove('active');
            });

            // Add active class to current link
            const activeLink = document.querySelector(`.toc a[href="#${id}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
            }
        }
    });
}

// Print page
window.printPage = function() {
    window.print();
};

// Download PDF (placeholder - would need PDF generation library)
window.downloadPDF = function() {
    notifications.info('PDF download feature coming soon');
};