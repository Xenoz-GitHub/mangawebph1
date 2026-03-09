// About page
import { supabase } from '../supabase.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    statNumbers: document.querySelectorAll('.stat-number'),
    timeline: document.querySelector('.timeline')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    animateTimeline();
});

// Load real statistics
async function loadStats() {
    try {
        // Get real stats from database
        const [
            { count: userCount },
            { count: mangaCount },
            { count: chapterCount },
            { count: commentCount }
        ] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true }),
            supabase.from('manga').select('*', { count: 'exact', head: true }),
            supabase.from('chapters').select('*', { count: 'exact', head: true }),
            supabase.from('comments').select('*', { count: 'exact', head: true })
        ]);

        // Format and display stats
        const stats = [
            Utils.formatNumber(userCount || 500000),
            Utils.formatNumber(mangaCount || 10000),
            Utils.formatNumber(chapterCount || 50000000),
            Utils.formatNumber(commentCount || 100000)
        ];

        elements.statNumbers.forEach((el, index) => {
            if (el && stats[index]) {
                animateValue(el, 0, stats[index], 2000);
            }
        });

    } catch (error) {
        console.error('Error loading stats:', error);
        // Fallback to default values
        const defaults = ['500K+', '10K+', '50M+', '100K+'];
        elements.statNumbers.forEach((el, index) => {
            if (el) {
                el.textContent = defaults[index];
            }
        });
    }
}

// Animate number counting
function animateValue(element, start, end, duration) {
    const startValue = parseInt(start.toString().replace(/[^0-9]/g, ''));
    const endValue = parseInt(end.toString().replace(/[^0-9]/g, ''));
    
    if (isNaN(startValue) || isNaN(endValue)) {
        element.textContent = end;
        return;
    }

    const range = endValue - startValue;
    const increment = range / (duration / 16);
    let current = startValue;
    const suffix = end.toString().replace(/[0-9]/g, '');

    const timer = setInterval(() => {
        current += increment;
        if (current >= endValue) {
            element.textContent = end;
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current) + suffix;
        }
    }, 16);
}

// Animate timeline on scroll
function animateTimeline() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.timeline-item').forEach(item => {
        observer.observe(item);
    });
}

// Team member data (you can replace with real team data)
const teamMembers = [
    {
        name: 'John Lloyd Suarez',
        role: 'Founder & Lead Developer',
        avatar: 'images/default-avatar.png',
        social: {
            facebook: 'https://www.facebook.com/Zawn.Loid.SuwaRizz',
            github: '#',
            twitter: '#'
        }
    },
    {
        name: 'Maria Santos',
        role: 'Community Manager',
        avatar: 'images/default-avatar.png',
        social: {
            facebook: '#',
            linkedin: '#',
            twitter: '#'
        }
    },
    {
        name: 'Mike Tan',
        role: 'Lead Designer',
        avatar: 'images/default-avatar.png',
        social: {
            instagram: '#',
            behance: '#',
            twitter: '#'
        }
    },
    {
        name: 'Anna Reyes',
        role: 'Content Curator',
        avatar: 'images/default-avatar.png',
        social: {
            facebook: '#',
            goodreads: '#',
            twitter: '#'
        }
    }
];

// Populate team section (called from HTML)
window.populateTeam = function() {
    const teamGrid = document.querySelector('.team-grid');
    if (!teamGrid) return;

    teamGrid.innerHTML = teamMembers.map(member => `
        <div class="team-card">
            <div class="team-image">
                <img src="${member.avatar}" alt="${Utils.escapeHtml(member.name)}">
            </div>
            <div class="team-info">
                <h3>${Utils.escapeHtml(member.name)}</h3>
                <p>${Utils.escapeHtml(member.role)}</p>
                <div class="team-social">
                    ${Object.entries(member.social).map(([platform, url]) => `
                        <a href="${url}" target="_blank" rel="noopener noreferrer">
                            <i class="fab fa-${platform}"></i>
                        </a>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');
};