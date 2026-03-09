// Achievements page
import { supabase, getCurrentUser, onAuthChange } from '../supabase.js';
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    totalAchievements: document.getElementById('totalAchievements'),
    completedAchievements: document.getElementById('completedAchievements'),
    completionRate: document.getElementById('completionRate'),
    totalXPEarned: document.getElementById('totalXPEarned'),
    achievementsGrid: document.getElementById('achievementsGrid'),
    filterBtns: document.querySelectorAll('.filter-btn')
};

// State
let currentUser = getCurrentUser();
let achievementsData = [];
let userAchievements = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        window.location.href = 'signin.html';
        return;
    }

    loadAchievements();
    setupEventListeners();

    // Listen for auth changes
    onAuthChange((user) => {
        currentUser = user;
        if (!user) {
            window.location.href = 'signin.html';
        }
    });
});

// Setup event listeners
function setupEventListeners() {
    elements.filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            elements.filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterAchievements(this.dataset.category);
        });
    });
}

// Load achievements
async function loadAchievements() {
    try {
        // Define all possible achievements
        achievementsData = [
            // Reading achievements
            { id: 1, name: 'Bookworm', description: 'Read 10 chapters', category: 'reading', target: 10, icon: 'fa-book-open', xp: 50, rarity: 'common' },
            { id: 2, name: 'Library Explorer', description: 'Read 50 chapters', category: 'reading', target: 50, icon: 'fa-book-open', xp: 100, rarity: 'common' },
            { id: 3, name: 'Reading Addict', description: 'Read 100 chapters', category: 'reading', target: 100, icon: 'fa-book-open', xp: 200, rarity: 'rare' },
            { id: 4, name: 'Book Master', description: 'Read 500 chapters', category: 'reading', target: 500, icon: 'fa-book-open', xp: 500, rarity: 'epic' },
            { id: 5, name: 'Legendary Reader', description: 'Read 1000 chapters', category: 'reading', target: 1000, icon: 'fa-crown', xp: 1000, rarity: 'legendary' },

            // Streak achievements
            { id: 6, name: 'Consistent Reader', description: '7 day streak', category: 'streak', target: 7, icon: 'fa-calendar-check', xp: 50, rarity: 'common' },
            { id: 7, name: 'Weekly Warrior', description: '30 day streak', category: 'streak', target: 30, icon: 'fa-calendar-check', xp: 150, rarity: 'rare' },
            { id: 8, name: 'Monthly Master', description: '60 day streak', category: 'streak', target: 60, icon: 'fa-calendar-check', xp: 300, rarity: 'epic' },
            { id: 9, name: 'Yearly Legend', description: '100 day streak', category: 'streak', target: 100, icon: 'fa-calendar-check', xp: 600, rarity: 'legendary' },

            // Social achievements
            { id: 10, name: 'Social Butterfly', description: 'Make 10 comments', category: 'social', target: 10, icon: 'fa-comments', xp: 50, rarity: 'common' },
            { id: 11, name: 'Community Star', description: 'Get 50 likes on comments', category: 'social', target: 50, icon: 'fa-heart', xp: 150, rarity: 'rare' },
            { id: 12, name: 'Influencer', description: 'Get 100 followers', category: 'social', target: 100, icon: 'fa-users', xp: 300, rarity: 'epic' },

            // Special achievements
            { id: 13, name: 'First Blood', description: 'Read your first chapter', category: 'special', target: 1, icon: 'fa-gem', xp: 10, rarity: 'common' },
            { id: 14, name: 'Reviewer', description: 'Rate 10 manga', category: 'special', target: 10, icon: 'fa-star', xp: 50, rarity: 'common' },
            { id: 15, name: 'Collector', description: 'Add 20 manga to favorites', category: 'special', target: 20, icon: 'fa-heart', xp: 100, rarity: 'rare' },
            { id: 16, name: 'Premium Member', description: 'Become a premium member', category: 'special', target: 1, icon: 'fa-crown', xp: 200, rarity: 'epic' },
            { id: 17, name: 'Early Bird', description: 'Read within 1 hour of release', category: 'special', target: 5, icon: 'fa-clock', xp: 150, rarity: 'rare' },

            // Rare achievements
            { id: 18, name: 'Completionist', description: 'Complete 10 manga', category: 'rare', target: 10, icon: 'fa-check-circle', xp: 200, rarity: 'rare' },
            { id: 19, name: 'All-Nighter', description: 'Read for 5 hours straight', category: 'rare', target: 1, icon: 'fa-moon', xp: 150, rarity: 'rare' },
            { id: 20, name: 'Manga Master', description: 'Read from 10 different genres', category: 'rare', target: 10, icon: 'fa-globe', xp: 300, rarity: 'epic' },
            { id: 21, name: 'Perfect Score', description: 'Give 50 five-star ratings', category: 'rare', target: 50, icon: 'fa-star', xp: 400, rarity: 'epic' },
            { id: 22, name: 'Legend', description: 'Reach level 50', category: 'rare', target: 50, icon: 'fa-level-up-alt', xp: 1000, rarity: 'legendary' }
        ];

        // Get user's unlocked achievements
        const { data: unlocked, error } = await supabase
            .from('achievements')
            .select('*')
            .eq('user_id', currentUser.id);

        if (error) throw error;

        userAchievements = unlocked || [];

        // Get user stats
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        updateStats(profile);
        displayAchievements(profile);

    } catch (error) {
        console.error('Error loading achievements:', error);
        notifications.error('Failed to load achievements');
    }
}

// Update statistics
function updateStats(profile) {
    const total = achievementsData.length;
    const completed = userAchievements.length;
    const rate = Math.round((completed / total) * 100);

    if (elements.totalAchievements) {
        elements.totalAchievements.textContent = total;
    }
    if (elements.completedAchievements) {
        elements.completedAchievements.textContent = completed;
    }
    if (elements.completionRate) {
        elements.completionRate.textContent = rate + '%';
    }

    // Calculate total XP earned from achievements
    const xpEarned = userAchievements.reduce((sum, a) => {
        const achievement = achievementsData.find(ad => ad.name === a.name);
        return sum + (achievement?.xp || 0);
    }, 0);

    if (elements.totalXPEarned) {
        elements.totalXPEarned.textContent = xpEarned;
    }
}

// Display achievements
function displayAchievements(profile) {
    if (!elements.achievementsGrid) return;

    const activeCategory = document.querySelector('.filter-btn.active')?.dataset.category || 'all';

    const filteredAchievements = achievementsData.filter(a =>
        activeCategory === 'all' || a.category === activeCategory
    );

    elements.achievementsGrid.innerHTML = filteredAchievements.map(achievement => {
        const isUnlocked = userAchievements.some(ua => ua.name === achievement.name);
        const progress = getProgress(achievement, profile);
        const percentage = Math.min((progress / achievement.target) * 100, 100);

        return `
            <div class="achievement-card ${isUnlocked ? '' : 'locked'} ${achievement.rarity}">
                <div class="achievement-icon">
                    <i class="fas ${achievement.icon}"></i>
                </div>
                <h3 class="achievement-name">${Utils.escapeHtml(achievement.name)}</h3>
                <p class="achievement-description">${Utils.escapeHtml(achievement.description)}</p>

                <div class="achievement-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%;"></div>
                    </div>
                    <div class="progress-text">
                        <span>${progress}/${achievement.target}</span>
                        <span>${Math.round(percentage)}%</span>
                    </div>
                </div>

                <div class="achievement-reward">
                    <i class="fas fa-star"></i>
                    <span>${achievement.xp} XP</span>
                </div>

                ${isUnlocked ? `
                    <div class="unlock-date">
                        ${getUnlockDate(achievement.name)}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Get progress for achievement
function getProgress(achievement, profile) {
    switch(achievement.name) {
        case 'Bookworm':
        case 'Library Explorer':
        case 'Reading Addict':
        case 'Book Master':
        case 'Legendary Reader':
            return profile.chapters_read || 0;

        case 'Consistent Reader':
        case 'Weekly Warrior':
        case 'Monthly Master':
        case 'Yearly Legend':
            return profile.streak || 0;

        case 'First Blood':
            return (profile.chapters_read || 0) > 0 ? 1 : 0;

        case 'Reviewer':
            return profile.ratings_count || 0;

        case 'Collector':
            // You'd need to get favorites count
            return 0;

        case 'Premium Member':
            return profile.is_premium ? 1 : 0;

        case 'Completionist':
            return profile.manga_finished || 0;

        case 'Manga Master':
            // You'd need to get distinct genres count
            return 0;

        case 'Legend':
            return profile.level || 1;

        default:
            return 0;
    }
}

// Get unlock date
function getUnlockDate(achievementName) {
    const achievement = userAchievements.find(a => a.name === achievementName);
    if (achievement) {
        return Utils.formatDate(achievement.unlocked_at, 'short');
    }
    return '';
}

// Filter achievements by category
function filterAchievements(category) {
    const filtered = achievementsData.filter(a =>
        category === 'all' || a.category === category
    );

    // Get user profile again
    supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()
        .then(({ data: profile }) => {
            displayAchievements(profile);
        });
}