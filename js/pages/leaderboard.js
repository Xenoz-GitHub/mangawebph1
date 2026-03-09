// Leaderboard page
import { supabase, getCurrentUser } from '../supabase.js';
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    topThree: document.getElementById('topThree'),
    leaderboardBody: document.getElementById('leaderboardBody'),
    userRankCard: document.getElementById('userRankCard'),
    periodBtns: document.querySelectorAll('.period-btn'),
    typeTabs: document.querySelectorAll('.leaderboard-tab')
};

// State
let currentType = 'chapters';
let currentPeriod = 'all';
let currentUser = getCurrentUser();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadLeaderboard();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Period buttons
    elements.periodBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            elements.periodBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentPeriod = this.dataset.period;
            loadLeaderboard();
        });
    });

    // Type tabs
    elements.typeTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            elements.typeTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentType = this.dataset.type;
            loadLeaderboard();
        });
    });
}

// Load leaderboard
async function loadLeaderboard() {
    try {
        let orderField;
        let valueField;

        switch(currentType) {
            case 'chapters':
                orderField = 'chapters_read';
                valueField = 'chapters_read';
                break;
            case 'streak':
                orderField = 'streak';
                valueField = 'streak';
                break;
            case 'xp':
                orderField = 'xp';
                valueField = 'xp';
                break;
            case 'manga':
                orderField = 'manga_finished';
                valueField = 'manga_finished';
                break;
            case 'ratings':
                orderField = 'ratings_count';
                valueField = 'ratings_count';
                break;
        }

        // Build query
        let query = supabase
            .from('profiles')
            .select('id, username, avatar_url, avatar_frame, is_premium, chapters_read, streak, xp, manga_finished, ratings_count')
            .order(orderField, { ascending: false });

        // Apply period filter
        if (currentPeriod !== 'all') {
            const date = new Date();
            if (currentPeriod === 'today') {
                date.setHours(0, 0, 0, 0);
                query = query.gte('last_login', date.toISOString());
            } else if (currentPeriod === 'week') {
                date.setDate(date.getDate() - 7);
                query = query.gte('last_login', date.toISOString());
            } else if (currentPeriod === 'month') {
                date.setMonth(date.getMonth() - 1);
                query = query.gte('last_login', date.toISOString());
            }
        }

        query = query.limit(50);

        const { data: users, error } = await query;

        if (error) throw error;

        displayLeaderboard(users, valueField);

        if (currentUser) {
            showUserRank(users, valueField);
        }

    } catch (error) {
        console.error('Error loading leaderboard:', error);
        notifications.error('Failed to load leaderboard');
    }
}

// Display leaderboard
function displayLeaderboard(users, valueField) {
    if (!elements.topThree || !elements.leaderboardBody) return;

    // Display top 3
    if (users.length >= 3) {
        elements.topThree.innerHTML = `
            ${createTopUser(users[1], 2, valueField)}
            ${createTopUser(users[0], 1, valueField)}
            ${createTopUser(users[2], 3, valueField)}
        `;
    } else if (users.length > 0) {
        elements.topThree.innerHTML = users.map((user, index) => 
            createTopUser(user, index + 1, valueField)
        ).join('');
    }

    // Display table
    elements.leaderboardBody.innerHTML = users.map((user, index) => {
        const rank = index + 1;
        const value = user[valueField] || 0;
        const medalClass = rank <= 3 ? `rank-${rank}` : '';

        return `
            <tr onclick="window.location.href='profile.html?id=${user.id}'">
                <td class="rank-number ${medalClass}">#${rank}</td>
                <td>
                    <div class="user-cell">
                        <div class="avatar-frame ${user.avatar_frame || ''}">
                            <img src="${user.avatar_url || 'images/default-avatar.png'}" alt="${Utils.escapeHtml(user.username)}">
                        </div>
                        <div>
                            <strong>${Utils.escapeHtml(user.username)}</strong>
                            ${user.is_premium ? '<i class="fas fa-crown" style="color: gold;" title="Premium Member"></i>' : ''}
                        </div>
                    </div>
                </td>
                <td><strong>${formatValue(value, currentType)}</strong></td>
                <td>
                    <span class="trend-icon">
                        <i class="fas ${getTrendIcon(rank)}"></i>
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Create top user display
function createTopUser(user, position, valueField) {
    const positionClass = position === 1 ? 'first' : (position === 2 ? 'second' : 'third');
    const rankEmoji = position === 1 ? '👑' : (position === 2 ? '🥈' : '🥉');
    const value = user[valueField] || 0;

    return `
        <div class="top-user ${positionClass}" onclick="window.location.href='profile.html?id=${user.id}'">
            <div class="rank-badge">${rankEmoji}</div>
            <div class="top-avatar avatar-frame ${user.avatar_frame || ''}">
                <img src="${user.avatar_url || 'images/default-avatar.png'}" alt="${Utils.escapeHtml(user.username)}">
            </div>
            <div class="top-info">
                <h3>${Utils.escapeHtml(user.username)}</h3>
                <p class="top-value">${formatValue(value, currentType)}</p>
                ${user.is_premium ? '<i class="fas fa-crown" style="color: gold;"></i>' : ''}
            </div>
        </div>
    `;
}

// Show current user's rank
function showUserRank(users, valueField) {
    if (!elements.userRankCard) return;

    const userIndex = users.findIndex(u => u.id === currentUser.id);

    if (userIndex !== -1) {
        const user = users[userIndex];
        const value = user[valueField] || 0;
        const nextValue = userIndex > 0 ? users[userIndex - 1][valueField] - value : null;

        elements.userRankCard.style.display = 'block';
        elements.userRankCard.innerHTML = `
            <div class="user-rank-content">
                <div class="user-rank-info">
                    <div class="avatar-frame ${user.avatar_frame || ''}">
                        <img src="${user.avatar_url || 'images/default-avatar.png'}" alt="${Utils.escapeHtml(user.username)}">
                    </div>
                    <div>
                        <h3>Your Rank</h3>
                        <p class="rank-number-large">#${userIndex + 1}</p>
                    </div>
                </div>
                <div class="user-rank-stats">
                    <div>
                        <small>Your Score</small>
                        <p class="stat-large">${formatValue(value, currentType)}</p>
                    </div>
                    ${nextValue !== null ? `
                        <div>
                            <small>Next Rank</small>
                            <p class="stat-large">${formatValue(nextValue, currentType)}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    } else {
        elements.userRankCard.style.display = 'none';
    }
}

// Format value based on type
function formatValue(value, type) {
    if (type === 'xp') {
        return value + ' XP';
    }
    return value;
}

// Get trend icon (simplified - in production you'd compare with previous period)
function getTrendIcon(rank) {
    const icons = ['fa-arrow-up', 'fa-arrow-up', 'fa-arrow-up', 'fa-minus', 'fa-arrow-down'];
    return icons[Math.min(rank - 1, icons.length - 1)] || 'fa-minus';
}