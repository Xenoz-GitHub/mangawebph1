// Home page JavaScript
import { supabase, onAuthChange, getCurrentUser } from '../supabase.js';
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    featuredManga: document.getElementById('featuredManga'),
    continueReading: document.getElementById('continueReading'),
    continueReadingGrid: document.getElementById('continueReadingGrid'),
    leaderboardPreview: document.getElementById('leaderboardPreview'),
    dailyTasksPreview: document.getElementById('dailyTasksPreview'),
    newsletterForm: document.getElementById('newsletterForm'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    userMenu: document.getElementById('userMenu'),
    userAvatar: document.getElementById('userAvatar'),
    logoutBtn: document.getElementById('logoutBtn')
};

// State
let currentUser = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    
    // Listen for auth changes
    onAuthChange(async (user) => {
        currentUser = user;
        updateUIForAuth();
        
        if (user) {
            await loadContinueReading();
            await loadDailyTasksPreview();
        }
    });
    
    // Load all sections
    await Promise.all([
        loadFeaturedManga(),
        loadLeaderboardPreview(),
        setupEventListeners()
    ]);
    
    hideLoading();
});

// Show loading
function showLoading() {
    if (elements.loadingSpinner) {
        elements.loadingSpinner.classList.remove('hidden');
    }
}

// Hide loading
function hideLoading() {
    if (elements.loadingSpinner) {
        setTimeout(() => {
            elements.loadingSpinner.classList.add('hidden');
        }, 500);
    }
}

// Update UI based on auth status
function updateUIForAuth() {
    const authButtons = document.getElementById('authButtons');
    
    if (currentUser) {
        if (authButtons) authButtons.classList.add('hidden');
        if (elements.userMenu) {
            elements.userMenu.classList.remove('hidden');
            loadUserAvatar();
        }
    } else {
        if (authButtons) authButtons.classList.remove('hidden');
        if (elements.userMenu) elements.userMenu.classList.add('hidden');
        if (elements.continueReading) {
            elements.continueReading.style.display = 'none';
        }
    }
}

// Load user avatar
async function loadUserAvatar() {
    if (!currentUser || !elements.userAvatar) return;
    
    try {
        const { data: profile } = await api.getProfile(currentUser.id);
        if (profile?.avatar_url) {
            elements.userAvatar.src = profile.avatar_url;
            
            // Apply avatar frame
            if (profile.avatar_frame) {
                elements.userAvatar.parentElement.className = `user-menu avatar-frame ${profile.avatar_frame}`;
            }
        }
    } catch (error) {
        console.error('Error loading avatar:', error);
    }
}

// Load featured manga
async function loadFeaturedManga() {
    if (!elements.featuredManga) return;
    
    try {
        const { data: manga, error } = await supabase
            .from('manga')
            .select('*')
            .order('views', { ascending: false })
            .limit(8);

        if (error) throw error;

        if (!manga || manga.length === 0) {
            elements.featuredManga.innerHTML = '<p class="no-data">No manga available</p>';
            return;
        }

        elements.featuredManga.innerHTML = manga.map((item, index) => `
            <div class="manga-card" onclick="window.location.href='pages/manga-details.html?id=${item.id}'" style="animation-delay: ${index * 0.1}s">
                <img src="${item.cover_url || 'images/no-cover.jpg'}" alt="${Utils.escapeHtml(item.title)}" loading="lazy">
                <div class="manga-info">
                    <h3 class="manga-title">${Utils.escapeHtml(item.title)}</h3>
                    <div class="manga-meta">
                        <span><i class="fas fa-star" style="color: gold;"></i> ${item.rating || 'N/A'}</span>
                        <span><i class="fas fa-eye"></i> ${Utils.formatNumber(item.views || 0)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading featured manga:', error);
        elements.featuredManga.innerHTML = '<p class="error">Error loading manga</p>';
    }
}

// Load continue reading for logged in users
async function loadContinueReading() {
    if (!currentUser || !elements.continueReading || !elements.continueReadingGrid) return;

    try {
        const { data: history, error } = await supabase
            .from('reading_history')
            .select(`
                *,
                manga:manga_id (*)
            `)
            .eq('user_id', currentUser.id)
            .order('last_read', { ascending: false })
            .limit(4);

        if (error) throw error;

        if (!history || history.length === 0) {
            elements.continueReading.style.display = 'none';
            return;
        }

        elements.continueReading.style.display = 'block';
        elements.continueReadingGrid.innerHTML = history.map((item, index) => `
            <div class="manga-card" onclick="window.location.href='pages/reader.html?manga=${item.manga_id}&chapter=${item.chapter_id}'" style="animation-delay: ${index * 0.1}s">
                <img src="${item.manga?.cover_url || 'images/no-cover.jpg'}" alt="${Utils.escapeHtml(item.manga?.title || '')}">
                <div class="manga-info">
                    <h3 class="manga-title">${Utils.escapeHtml(item.manga?.title || '')}</h3>
                    <div class="manga-meta">
                        <span>Chapter ${item.chapter_number || 1}</span>
                        <span>${item.read_percentage || 0}%</span>
                    </div>
                    <div class="progress-bar" style="height: 4px; background: rgba(108,92,231,0.2); margin-top: 10px;">
                        <div style="width: ${item.read_percentage || 0}%; height: 100%; background: linear-gradient(135deg, var(--primary-color), var(--accent-color));"></div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading continue reading:', error);
    }
}

// Load leaderboard preview
async function loadLeaderboardPreview() {
    if (!elements.leaderboardPreview) return;

    try {
        const { data: readers, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, avatar_frame, chapters_read')
            .order('chapters_read', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!readers || readers.length === 0) {
            elements.leaderboardPreview.innerHTML = '<p class="no-data">No data available</p>';
            return;
        }

        elements.leaderboardPreview.innerHTML = readers.map((reader, index) => `
            <div class="leaderboard-item" onclick="window.location.href='pages/profile.html?id=${reader.id}'">
                <span class="rank">#${index + 1}</span>
                <div class="avatar-frame ${reader.avatar_frame || ''}">
                    <img src="${reader.avatar_url || 'images/default-avatar.png'}" alt="${Utils.escapeHtml(reader.username)}">
                </div>
                <span class="name">${Utils.escapeHtml(reader.username)}</span>
                <span class="chapters">${Utils.formatNumber(reader.chapters_read || 0)} chapters</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

// Load daily tasks preview
async function loadDailyTasksPreview() {
    if (!currentUser || !elements.dailyTasksPreview) return;

    try {
        const { data: tasks, error } = await api.getDailyTasks(currentUser.id);
        
        if (error) throw error;

        if (!tasks || tasks.length === 0) {
            elements.dailyTasksPreview.innerHTML = '<p class="no-data">No tasks available</p>';
            return;
        }

        elements.dailyTasksPreview.innerHTML = tasks.slice(0, 3).map(task => {
            const progress = (task.current / task.target) * 100;
            return `
                <div class="task-card ${task.completed ? 'completed' : ''}">
                    <div class="task-icon">
                        <i class="fas ${task.icon}"></i>
                    </div>
                    <h4>${Utils.escapeHtml(task.title)}</h4>
                    <p>${Utils.escapeHtml(task.description)}</p>
                    <div class="task-progress">
                        <div class="task-progress-bar">
                            <div class="task-progress-fill" style="width: ${progress}%;"></div>
                        </div>
                        <span>${task.current}/${task.target}</span>
                    </div>
                    <span class="task-reward">+${task.reward} XP</span>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading tasks preview:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Newsletter form
    if (elements.newsletterForm) {
        elements.newsletterForm.addEventListener('submit', handleNewsletter);
    }

    // Logout button
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Burger menu
    const burgerMenu = document.getElementById('burgerMenu');
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (burgerMenu && mobileMenu) {
        burgerMenu.addEventListener('click', () => {
            burgerMenu.classList.toggle('active');
            mobileMenu.classList.toggle('active');
        });

        // Close mobile menu when clicking a link
        document.querySelectorAll('.mobile-link').forEach(link => {
            link.addEventListener('click', () => {
                burgerMenu.classList.remove('active');
                mobileMenu.classList.remove('active');
            });
        });
    }

    // Back to top
    const backToTop = document.getElementById('backToTop');
    if (backToTop) {
        window.addEventListener('scroll', () => {
            backToTop.classList.toggle('show', window.scrollY > 300);
        });

        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

// Handle newsletter submission
async function handleNewsletter(e) {
    e.preventDefault();
    
    const emailInput = e.target.querySelector('input[type="email"]');
    const email = emailInput?.value;

    if (!email || !Utils.isValidEmail(email)) {
        notifications.error('Please enter a valid email address');
        return;
    }

    try {
        const { error } = await supabase
            .from('newsletter_subscribers')
            .insert([{ email, subscribed_at: new Date().toISOString() }]);

        if (error) {
            if (error.code === '23505') { // Unique violation
                notifications.warning('This email is already subscribed');
            } else {
                throw error;
            }
        } else {
            notifications.success('Successfully subscribed to newsletter!');
            e.target.reset();
        }
    } catch (error) {
        console.error('Newsletter error:', error);
        notifications.error('Failed to subscribe. Please try again.');
    }
}

// Handle logout
async function handleLogout(e) {
    e.preventDefault();
    await api.signOut();
}

// Toggle theme
function toggleTheme() {
    document.body.classList.toggle('night-mode');
    const icon = document.querySelector('#themeToggle i');
    
    if (document.body.classList.contains('night-mode')) {
        icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'night');
    } else {
        icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    }
}

// Apply saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'night') {
    document.body.classList.add('night-mode');
    const icon = document.querySelector('#themeToggle i');
    if (icon) icon.className = 'fas fa-sun';
}