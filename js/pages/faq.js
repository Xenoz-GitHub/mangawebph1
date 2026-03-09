// FAQ page
import { supabase } from '../supabase.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    searchInput: document.getElementById('faqSearch'),
    categoryBtns: document.querySelectorAll('.category-btn'),
    faqItems: document.querySelectorAll('.faq-item'),
    faqSections: document.querySelectorAll('.faq-section')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadFAQs();
});

// Setup event listeners
function setupEventListeners() {
    // Search
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', Utils.debounce(searchFAQ, 300));
    }

    // Category buttons
    elements.categoryBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            elements.categoryBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterByCategory(this.dataset.category);
        });
    });

    // FAQ items
    elements.faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', () => {
                toggleFAQ(item);
            });
        }
    });
}

// Load FAQs from database (optional - you can hardcode FAQs)
async function loadFAQs() {
    try {
        const { data: faqs, error } = await supabase
            .from('faqs')
            .select('*')
            .order('order');

        if (error) throw error;

        if (faqs && faqs.length > 0) {
            updateFAQs(faqs);
        }
    } catch (error) {
        console.error('Error loading FAQs:', error);
        // Use default FAQs if database fails
    }
}

// Update FAQs with data from database
function updateFAQs(faqs) {
    const sections = {};

    faqs.forEach(faq => {
        if (!sections[faq.category]) {
            sections[faq.category] = [];
        }
        sections[faq.category].push(faq);
    });

    Object.entries(sections).forEach(([category, items]) => {
        const section = document.querySelector(`[data-category="${category}"]`);
        if (section) {
            const container = section.querySelector('.faq-items') || section;
            container.innerHTML = items.map(faq => `
                <div class="faq-item">
                    <div class="faq-question">
                        ${Utils.escapeHtml(faq.question)}
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="faq-answer">
                        ${Utils.escapeHtml(faq.answer)}
                    </div>
                </div>
            `).join('');
        }
    });
}

// Toggle FAQ answer
function toggleFAQ(item) {
    const answer = item.querySelector('.faq-answer');
    const icon = item.querySelector('.faq-question i');

    if (answer) {
        answer.classList.toggle('show');
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
    }
}

// Search FAQ
function searchFAQ() {
    const searchTerm = elements.searchInput.value.toLowerCase();

    elements.faqItems.forEach(item => {
        const question = item.querySelector('.faq-question').innerText.toLowerCase();
        const answer = item.querySelector('.faq-answer').innerText.toLowerCase();

        if (question.includes(searchTerm) || answer.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });

    // Show/hide sections based on visible items
    elements.faqSections.forEach(section => {
        const visibleItems = section.querySelectorAll('.faq-item[style="display: block;"]').length;
        if (visibleItems === 0 && searchTerm !== '') {
            section.style.display = 'none';
        } else {
            section.style.display = 'block';
        }
    });
}

// Filter by category
function filterByCategory(category) {
    elements.faqSections.forEach(section => {
        if (category === 'all' || section.dataset.category === category) {
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    });

    // Reset search
    if (elements.searchInput) {
        elements.searchInput.value = '';
    }
}

// Contact support button
document.querySelector('.contact-btn')?.addEventListener('click', () => {
    window.location.href = 'contact.html';
});