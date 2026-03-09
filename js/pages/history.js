// Reading History page - PRODUCTION READY
import { supabase, getCurrentUser, onAuthChange } from '../supabase.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    totalChapters: document.getElementById('totalChapters'),
    totalManga: document.getElementById('totalManga'),
    readingTime: document.getElementById('readingTime'),
    avgPerDay: document.getElementById('avgPerDay'),
    historyList: document.getElementById('historyList'),
    timelineBtns: document.querySelectorAll('.timeline-btn'),
    clearBtn: document.querySelector('.clear-btn'),
    exportBtn: document.querySelector('.export-btn')
};

// State
let currentUser = null;
let history = [];
let currentTimeline = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    onAuthChange(async (user) => {
        currentUser = user;
        if (!user) {
            window.location.href = 'signin.html';
            return;
        }
        await loadHistory();
        await loadStats();
    });

    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Timeline filter buttons
    elements.timelineBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            elements.timelineBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentTimeline = this.dataset.timeline;
            filterHistory();
        });
    });

    // Clear history button
    if (elements.clearBtn) {
        elements.clearBtn.addEventListener('click', clearHistory);
    }

    // Export button
    if (elements.exportBtn) {
        elements.exportBtn.addEventListener('click', exportHistory);
    }
}

// Load reading history
async function loadHistory() {
    if (!currentUser) return;

    showLoading();

    try {
        const { data: historyData, error } = await supabase
            .from('reading_history')
            .select(`
                *,
                manga:manga_id (*)
            `)
            .eq('user_id', currentUser.id)
            .order('last_read', { ascending: false });

        if (error) throw error;

        history = historyData || [];
        displayHistory();

    } catch (error) {
        console.error('Error loading history:', error);
        notifications.error('Failed to load history');
        showError();
    }
}

// Display history
function displayHistory() {
    if (!elements.historyList) return;

    if (history.length === 0) {
        elements.historyList.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-history"></i>
                <h3>No Reading History</h3>
                <p>Start reading manga to see your history here</p>
                <a href="manga.html" class="btn-primary">Browse Manga</a>
            </div>
        `;
        return;
    }

    // Group by date
    const grouped = groupByDate(history);

    elements.historyList.innerHTML = Object.entries(grouped).map(([date, items]) => `
        <div class="history-date-group">
            <div class="date-header" style="font-size: 1.2rem; font-weight: 600; margin: 1.5rem 0 1rem; color: var(--primary-color);">
                <i class="fas fa-calendar-day"></i> ${formatDateHeader(date)}
            </div>
            ${items.map(item => createHistoryItem(item)).join('')}
        </div>
    `).join('');
}

// Group history by date
function groupByDate(items) {
    const grouped = {};

    items.forEach(item => {
        const date = new Date(item.last_read).toDateString();
        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(item);
    });

    return grouped;
}

// Format date header
function formatDateHeader(dateStr) {
    const date = new Date(dateStr);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// Create history item HTML
function createHistoryItem(item) {
    const manga = item.manga;
    if (!manga) return '';

    return `
        <div class="history-item" onclick="continueReading(${manga.id}, ${item.chapter_id})">
            <div class="history-cover">
                <img src="${manga.cover_url || '../images/no-cover.jpg'}" 
                     alt="${Utils.escapeHtml(manga.title)}"
                     loading="lazy">
            </div>
            <div class="history-info">
                <h3 class="history-title">${Utils.escapeHtml(manga.title)}</h3>
                <div class="history-meta">
                    <span><i class="fas fa-book-open"></i> Chapter ${item.chapter_number}</span>
                    <span><i class="fas fa-clock"></i> ${Utils.timeAgo(item.last_read)}</span>
                </div>
            </div>
            <div class="history-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${item.read_percentage || 0}%;"></div>
                </div>
                <div class="progress-text">${item.read_percentage || 0}%</div>
            </div>
            <div class="history-actions">
                <button class="history-action-btn" onclick="continueReading(${manga.id}, ${item.chapter_id}, event)" title="Continue Reading">
                    <i class="fas fa-play"></i>
                </button>
                <button class="history-action-btn delete" onclick="removeFromHistory(${item.id}, event)" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
}

// Filter history by timeline
function filterHistory() {
    const filtered = history.filter(item => {
        const date = new Date(item.last_read);
        const now = new Date();

        switch(currentTimeline) {
            case 'today':
                return date.toDateString() === now.toDateString();
            
            case 'week':
                const weekAgo = new Date(now.setDate(now.getDate() - 7));
                return date >= weekAgo;
            
            case 'month':
                const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
                return date >= monthAgo;
            
            case 'year':
                const yearAgo = new Date(now.setFullYear(now.getFullYear() - 1));
                return date >= yearAgo;
            
            default:
                return true;
        }
    });

    // Group filtered items by date
    const grouped = groupByDate(filtered);

    if (elements.historyList) {
        if (filtered.length === 0) {
            elements.historyList.innerHTML = `
                <div class="empty-history">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No History for This Period</h3>
                    <p>Try a different time filter</p>
                </div>
            `;
        } else {
            elements.historyList.innerHTML = Object.entries(grouped).map(([date, items]) => `
                <div class="history-date-group">
                    <div class="date-header" style="font-size: 1.2rem; font-weight: 600; margin: 1.5rem 0 1rem; color: var(--primary-color);">
                        <i class="fas fa-calendar-day"></i> ${formatDateHeader(date)}
                    </div>
                    ${items.map(item => createHistoryItem(item)).join('')}
                </div>
            `).join('');
        }
    }
}

// Load statistics
async function loadStats() {
    if (!currentUser) return;

    try {
        // Get profile stats
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('chapters_read, reading_time')
            .eq('id', currentUser.id)
            .single();

        if (profileError) throw profileError;

        // Get unique manga count
        const { data: uniqueManga, error: mangaError } = await supase
            .from('reading_history')
            .select('manga_id')
            .eq('user_id', currentUser.id);

        if (mangaError) throw mangaError;

        const uniqueMangaCount = new Set(uniqueManga?.map(u => u.manga_id)).size;

        // Calculate average per day (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { count: recentChapters, error: recentError } = await supabase
            .from('reading_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .gte('last_read', thirtyDaysAgo.toISOString());

        if (recentError) throw recentError;

        const avgPerDay = ((recentChapters || 0) / 30).toFixed(1);

        // Update UI
        if (elements.totalChapters) {
            elements.totalChapters.textContent = profile?.chapters_read || 0;
        }
        if (elements.totalManga) {
            elements.totalManga.textContent = uniqueMangaCount || 0;
        }
        if (elements.readingTime) {
            elements.readingTime.textContent = Math.floor((profile?.reading_time || 0) / 60);
        }
        if (elements.avgPerDay) {
            elements.avgPerDay.textContent = avgPerDay;
        }

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Continue reading
window.continueReading = function(mangaId, chapterId, event) {
    if (event) event.stopPropagation();
    window.location.href = `reader.html?manga=${mangaId}&chapter=${chapterId}`;
};

// Remove from history
window.removeFromHistory = async function(historyId, event) {
    event.stopPropagation();

    if (!confirm('Remove this item from history?')) return;

    try {
        const { error } = await supabase
            .from('reading_history')
            .delete()
            .eq('id', historyId);

        if (error) throw error;

        // Remove from local array
        history = history.filter(h => h.id !== historyId);
        
        // Refresh display
        filterHistory();
        
        // Reload stats
        await loadStats();

        notifications.success('Removed from history');

    } catch (error) {
        console.error('Error removing from history:', error);
        notifications.error('Failed to remove from history');
    }
};

// Clear all history
async function clearHistory() {
    if (!confirm('Are you sure you want to clear ALL reading history? This cannot be undone.')) return;

    try {
        const { error } = await supabase
            .from('reading_history')
            .delete()
            .eq('user_id', currentUser.id);

        if (error) throw error;

        // Reset profile stats
        await supabase
            .from('profiles')
            .update({ 
                chapters_read: 0,
                reading_time: 0 
            })
            .eq('id', currentUser.id);

        history = [];
        displayHistory();
        await loadStats();

        notifications.success('History cleared');

    } catch (error) {
        console.error('Error clearing history:', error);
        notifications.error('Failed to clear history');
    }
}

// Export history
async function exportHistory() {
    try {
        const { data, error } = await supabase
            .from('reading_history')
            .select(`
                *,
                manga:manga_id (title, author)
            `)
            .eq('user_id', currentUser.id)
            .order('last_read', { ascending: false });

        if (error) throw error;

        const exportData = data.map(item => ({
            manga_title: item.manga?.title,
            chapter: item.chapter_number,
            progress: `${item.read_percentage}%`,
            last_read: new Date(item.last_read).toLocaleString(),
            completed: item.completed
        }));

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reading-history-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        notifications.success('History exported');

    } catch (error) {
        console.error('Error exporting history:', error);
        notifications.error('Failed to export history');
    }
}

// Show loading
function showLoading() {
    if (!elements.historyList) return;

    elements.historyList.innerHTML = `
        <div class="loading-skeleton">
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
        </div>
    `;
}

// Show error
function showError() {
    if (!elements.historyList) return;

    elements.historyList.innerHTML = `
        <div class="empty-history">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Error Loading History</h3>
            <p>Please try refreshing the page</p>
            <button class="btn-primary" onclick="location.reload()">Refresh</button>
        </div>
    `;
}