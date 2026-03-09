// Dashboard page
import { supabase, getCurrentUser, onAuthChange } from '../supabase.js';
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    userName: document.getElementById('userName'),
    userStreak: document.getElementById('userStreak'),
    streakCount: document.getElementById('streakCount'),
    totalChapters: document.getElementById('totalChapters'),
    totalManga: document.getElementById('totalManga'),
    readingTime: document.getElementById('readingTime'),
    achievementCount: document.getElementById('achievementCount'),
    continueReadingList: document.getElementById('continueReadingList'),
    todayActivity: document.getElementById('todayActivity'),
    recommendationsGrid: document.getElementById('recommendationsGrid'),
    recentAchievements: document.getElementById('recentAchievements'),
    monthlyGoal: document.getElementById('monthlyGoal'),
    monthlyProgress: document.getElementById('monthlyProgress'),
    monthlyGoalFill: document.getElementById('monthlyGoalFill'),
    yearlyGoal: document.getElementById('yearlyGoal'),
    yearlyProgress: document.getElementById('yearlyProgress'),
    yearlyGoalFill: document.getElementById('yearlyGoalFill'),
    currentDate: document.getElementById('currentDate')
};

// State
let currentUser = getCurrentUser();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        window.location.href = 'signin.html';
        return;
    }

    // Set current date
    if (elements.currentDate) {
        elements.currentDate.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    loadDashboard();
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
    // Set goal button
    document.querySelector('.goals-section .btn-secondary')?.addEventListener('click', setGoal);
}

// Load dashboard data
async function loadDashboard() {
    try {
        // Get user profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;

        // Update UI with profile data
        if (elements.userName) {
            elements.userName.textContent = profile.username;
        }
        if (elements.userStreak) {
            elements.userStreak.textContent = profile.streak || 0;
        }
        if (elements.streakCount) {
            elements.streakCount.textContent = profile.streak || 0;
        }
        if (elements.totalChapters) {
            elements.totalChapters.textContent = profile.chapters_read || 0;
        }
        if (elements.totalManga) {
            elements.totalManga.textContent = profile.manga_finished || 0;
        }
        if (elements.readingTime) {
            elements.readingTime.textContent = Math.floor((profile.reading_time || 0) / 60);
        }

        // Load all sections in parallel
        await Promise.all([
            loadContinueReading(),
            loadTodayActivity(),
            loadRecommendations(),
            loadRecentAchievements(),
            loadGoals(),
            loadAchievementsCount()
        ]);

    } catch (error) {
        console.error('Error loading dashboard:', error);
        notifications.error('Failed to load dashboard data');
    }
}

// Load achievements count
async function loadAchievementsCount() {
    try {
        const { count, error } = await supabase
            .from('achievements')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id);

        if (error) throw error;

        if (elements.achievementCount) {
            elements.achievementCount.textContent = count || 0;
        }
    } catch (error) {
        console.error('Error loading achievements count:', error);
    }
}

// Load continue reading
async function loadContinueReading() {
    if (!elements.continueReadingList) return;

    try {
        const { data: history, error } = await supabase
            .from('reading_history')
            .select(`
                *,
                manga:manga_id (*)
            `)
            .eq('user_id', currentUser.id)
            .order('last_read', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!history || history.length === 0) {
            elements.continueReadingList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-book-open"></i>
                    <p>No reading history yet</p>
                    <a href="manga.html" class="btn-primary">Browse Manga</a>
                </div>
            `;
            return;
        }

        elements.continueReadingList.innerHTML = history.map(item => `
            <div class="continue-item" onclick="window.location.href='reader.html?manga=${item.manga_id}&chapter=${item.chapter_id}'">
                <img src="${item.manga?.cover_url || 'images/no-cover.jpg'}" alt="${Utils.escapeHtml(item.manga?.title || '')}">
                <div class="continue-info">
                    <h4>${Utils.escapeHtml(item.manga?.title || '')}</h4>
                    <p>Chapter ${item.chapter_number}</p>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${item.read_percentage || 0}%;"></div>
                        </div>
                        <span class="progress-text">${item.read_percentage || 0}%</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading continue reading:', error);
    }
}

// Load today's activity
async function loadTodayActivity() {
    if (!elements.todayActivity) return;

    try {
        const today = new Date().toISOString().split('T')[0];

        const { data: activities, error } = await supabase
            .from('user_activities')
            .select('*')
            .eq('user_id', currentUser.id)
            .gte('created_at', today)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        if (!activities || activities.length === 0) {
            elements.todayActivity.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-day"></i>
                    <p>No activity today</p>
                </div>
            `;
            return;
        }

        elements.todayActivity.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-dot ${activity.activity_type}"></div>
                <div class="activity-content">
                    <p>${getActivityText(activity)}</p>
                    <span class="activity-time">${Utils.timeAgo(activity.created_at)}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading activities:', error);
    }
}

// Get activity text
function getActivityText(activity) {
    const data = activity.activity_data || {};
    switch(activity.activity_type) {
        case 'read':
            return `Read a chapter`;
        case 'rating':
            return `Rated a manga`;
        case 'comment':
            return `Left a comment`;
        case 'achievement':
            return `Earned achievement: ${data.achievement || 'Unknown'}`;
        case 'follow':
            return `Followed someone`;
        case 'favorite':
            return `Added to favorites`;
        default:
            return 'Activity recorded';
    }
}

// Load recommendations
async function loadRecommendations() {
    if (!elements.recommendationsGrid) return;

    try {
        // Get user's favorite genres from reading history
        const { data: history } = await supabase
            .from('reading_history')
            .select('manga:manga_id(genres)')
            .eq('user_id', currentUser.id)
            .limit(20);

        // Count genre frequency
        const genreCount = {};
        history?.forEach(item => {
            const genres = item.manga?.genres || [];
            genres.forEach(genre => {
                genreCount[genre] = (genreCount[genre] || 0) + 1;
            });
        });

        // Get top genre
        const topGenre = Object.entries(genreCount)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0])[0] || 'action';

        // Get recommendations
        const { data: manga, error } = await supabase
            .from('manga')
            .select('*')
            .not('id', 'in', `(select manga_id from reading_history where user_id = '${currentUser.id}')`)
            .contains('genres', [topGenre])
            .limit(6);

        if (error) throw error;

        if (!manga || manga.length === 0) {
            elements.recommendationsGrid.innerHTML = `
                <div class="empty-state">
                    <p>No recommendations yet</p>
                </div>
            `;
            return;
        }

        elements.recommendationsGrid.innerHTML = manga.map(m => `
            <div class="recommend-item" onclick="window.location.href='manga-details.html?id=${m.id}'">
                <img src="${m.cover_url || 'images/no-cover.jpg'}" alt="${Utils.escapeHtml(m.title)}">
                <h4>${Utils.escapeHtml(m.title)}</h4>
                <p>${m.rating?.toFixed(1) || 'N/A'} ★</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading recommendations:', error);
    }
}

// Load recent achievements
async function loadRecentAchievements() {
    if (!elements.recentAchievements) return;

    try {
        const { data: achievements, error } = await supabase
            .from('achievements')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('unlocked_at', { ascending: false })
            .limit(3);

        if (error) throw error;

        if (!achievements || achievements.length === 0) {
            elements.recentAchievements.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-trophy"></i>
                    <p>No achievements yet</p>
                </div>
            `;
            return;
        }

        elements.recentAchievements.innerHTML = achievements.map(a => `
            <div class="achievement-mini">
                <i class="fas fa-trophy"></i>
                <strong>${Utils.escapeHtml(a.name)}</strong>
                <span>${Utils.formatDate(a.unlocked_at, 'short')}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading achievements:', error);
    }
}

// Load reading goals
async function loadGoals() {
    try {
        const year = new Date().getFullYear();

        // Get or create yearly goal
        let { data: goal, error } = await supabase
            .from('reading_goals')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('year', year)
            .maybeSingle();

        if (!goal) {
            // Create default goal
            const { data: newGoal, error: createError } = await supabase
                .from('reading_goals')
                .insert([{
                    user_id: currentUser.id,
                    year: year,
                    target_chapters: 365,
                    target_manga: 52,
                    current_chapters: 0,
                    current_manga: 0
                }])
                .select()
                .single();

            if (createError) throw createError;
            goal = newGoal;
        }

        // Get chapters read this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: monthlyChapters } = await supabase
            .from('reading_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .gte('last_read', startOfMonth.toISOString());

        // Get current chapters count
        const { data: profile } = await supabase
            .from('profiles')
            .select('chapters_read, manga_finished')
            .eq('id', currentUser.id)
            .single();

        // Update goal progress
        await supabase
            .from('reading_goals')
            .update({
                current_chapters: profile?.chapters_read || 0,
                current_manga: profile?.manga_finished || 0
            })
            .eq('id', goal.id);

        // Update monthly goal display
        const monthlyGoal = 30; // Default monthly goal
        const monthlyProgress = ((monthlyChapters || 0) / monthlyGoal) * 100;

        if (elements.monthlyGoal) {
            elements.monthlyGoal.textContent = monthlyGoal;
        }
        if (elements.monthlyProgress) {
            elements.monthlyProgress.textContent = `${monthlyChapters || 0}/${monthlyGoal}`;
        }
        if (elements.monthlyGoalFill) {
            elements.monthlyGoalFill.style.width = `${Math.min(monthlyProgress, 100)}%`;
        }

        // Update yearly goal display
        const yearlyProgress = ((goal.current_chapters || 0) / goal.target_chapters) * 100;

        if (elements.yearlyGoal) {
            elements.yearlyGoal.textContent = goal.target_chapters;
        }
        if (elements.yearlyProgress) {
            elements.yearlyProgress.textContent = `${goal.current_chapters || 0}/${goal.target_chapters}`;
        }
        if (elements.yearlyGoalFill) {
            elements.yearlyGoalFill.style.width = `${Math.min(yearlyProgress, 100)}%`;
        }

    } catch (error) {
        console.error('Error loading goals:', error);
    }
}

// Set new goal
async function setGoal() {
    const chapters = prompt('Set your monthly chapter goal:', '30');
    if (!chapters) return;

    const numChapters = parseInt(chapters);
    if (isNaN(numChapters) || numChapters < 1) {
        notifications.error('Please enter a valid number');
        return;
    }

    try {
        // Save to database (you might want to add a monthly_goals table)
        localStorage.setItem('monthlyGoal', numChapters);
        
        if (elements.monthlyGoal) {
            elements.monthlyGoal.textContent = numChapters;
        }

        notifications.success('Goal updated successfully');
    } catch (error) {
        console.error('Error setting goal:', error);
        notifications.error('Failed to update goal');
    }
}