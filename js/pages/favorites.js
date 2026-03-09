// Favorites page - PRODUCTION READY
import { supabase, getCurrentUser, onAuthChange } from '../supabase.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    totalFavorites: document.getElementById('totalFavorites'),
    readingNow: document.getElementById('readingNow'),
    completed: document.getElementById('completed'),
    planToRead: document.getElementById('planToRead'),
    favoritesGrid: document.getElementById('favoritesGrid'),
    filterBtns: document.querySelectorAll('.filter-btn')
};

// State
let currentUser = null;
let favorites = [];
let readingProgress = new Map(); // manga_id -> reading status

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Listen for auth changes
    onAuthChange(async (user) => {
        currentUser = user;
        if (!user) {
            window.location.href = 'signin.html';
            return;
        }
        await loadFavorites();
    });
});

// Load favorites from database
async function loadFavorites() {
    if (!currentUser) return;

    showLoading();

    try {
        // Get user's favorites
        const { data: favs, error: favError } = await supabase
            .from('favorites')
            .select(`
                *,
                manga:manga_id (*)
            `)
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (favError) throw favError;

        favorites = favs || [];

        // Get reading progress for each manga
        await loadReadingProgress();

        // Update UI
        displayFavorites();
        updateStats();

    } catch (error) {
        console.error('Error loading favorites:', error);
        notifications.error('Failed to load favorites');
        showError();
    }
}

// Load reading progress for all favorited manga
async function loadReadingProgress() {
    if (!currentUser || favorites.length === 0) return;

    try {
        const mangaIds = favorites.map(f => f.manga_id);

        const { data: history, error } = await supabase
            .from('reading_history')
            .select('manga_id, completed, read_percentage, last_read')
            .eq('user_id', currentUser.id)
            .in('manga_id', mangaIds)
            .order('last_read', { ascending: false });

        if (error) throw error;

        // Create a map of the most recent reading progress per manga
        readingProgress.clear();
        history?.forEach(item => {
            if (!readingProgress.has(item.manga_id)) {
                readingProgress.set(item.manga_id, {
                    completed: item.completed,
                    progress: item.read_percentage || 0
                });
            }
        });

        // For manga with no reading history, set default
        favorites.forEach(f => {
            if (!readingProgress.has(f.manga_id)) {
                readingProgress.set(f.manga_id, {
                    completed: false,
                    progress: 0
                });
            }
        });

    } catch (error) {
        console.error('Error loading reading progress:', error);
    }
}

// Display favorites
function displayFavorites() {
    if (!elements.favoritesGrid) return;

    if (favorites.length === 0) {
        elements.favoritesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-heart-broken"></i>
                <h3>No Favorites Yet</h3>
                <p>Start adding manga to your favorites collection</p>
                <a href="manga.html" class="btn-primary">Browse Manga</a>
            </div>
        `;
        return;
    }

    elements.favoritesGrid.innerHTML = favorites.map(item => {
        const manga = item.manga;
        const progress = readingProgress.get(manga.id) || { completed: false, progress: 0 };
        const status = progress.completed ? 'completed' : (progress.progress > 0 ? 'reading' : 'plan');

        return `
            <div class="favorite-card" data-manga-id="${manga.id}" data-status="${status}">
                <img src="${manga.cover_url || '../images/no-cover.jpg'}" 
                     alt="${Utils.escapeHtml(manga.title)}"
                     loading="lazy"
                     onclick="window.location.href='manga-details.html?id=${manga.id}'">
                <button class="remove-favorite" onclick="removeFavorite('${manga.id}', event)">
                    <i class="fas fa-times"></i>
                </button>
                <div class="favorite-info" onclick="window.location.href='manga-details.html?id=${manga.id}'">
                    <h3 class="favorite-title">${Utils.escapeHtml(manga.title)}</h3>
                    <div class="favorite-meta">
                        <span><i class="fas fa-star" style="color: gold;"></i> ${manga.rating?.toFixed(1) || 'N/A'}</span>
                        <span><i class="fas fa-book-open"></i> ${manga.latest_chapter || 0}</span>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.8rem;">
                        ${progress.progress > 0 ? `${progress.progress}% read` : 'Not started'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Update statistics
function updateStats() {
    if (!elements.totalFavorites) return;

    const total = favorites.length;
    
    // Count by status
    let reading = 0;
    let completed = 0;
    let plan = 0;

    favorites.forEach(f => {
        const progress = readingProgress.get(f.manga_id);
        if (progress?.completed) {
            completed++;
        } else if (progress?.progress > 0) {
            reading++;
        } else {
            plan++;
        }
    });

    elements.totalFavorites.textContent = total;
    elements.readingNow.textContent = reading;
    elements.completed.textContent = completed;
    elements.planToRead.textContent = plan;
}

// Remove from favorites
window.removeFavorite = async function(mangaId, event) {
    event.stopPropagation();

    if (!currentUser) return;

    if (!confirm('Remove from favorites?')) return;

    try {
        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('manga_id', mangaId);

        if (error) throw error;

        // Remove from local array
        favorites = favorites.filter(f => f.manga_id !== mangaId);
        readingProgress.delete(mangaId);

        // Remove from DOM
        const card = event.target.closest('.favorite-card');
        if (card) {
            card.remove();
        }

        updateStats();

        // Show empty state if no favorites left
        if (favorites.length === 0) {
            elements.favoritesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-heart-broken"></i>
                    <h3>No Favorites Yet</h3>
                    <p>Start adding manga to your favorites collection</p>
                    <a href="manga.html" class="btn-primary">Browse Manga</a>
                </div>
            `;
        }

        notifications.success('Removed from favorites');

    } catch (error) {
        console.error('Error removing favorite:', error);
        notifications.error('Failed to remove from favorites');
    }
};

// Filter favorites
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const filter = this.dataset.filter;
        
        // Update active button
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Filter cards
        document.querySelectorAll('.favorite-card').forEach(card => {
            const status = card.dataset.status;
            if (filter === 'all' || status === filter) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
});

// Show loading skeleton
function showLoading() {
    if (!elements.favoritesGrid) return;

    elements.favoritesGrid.innerHTML = `
        <div class="loading-skeleton">
            ${Array(8).fill('<div class="skeleton-card"></div>').join('')}
        </div>
    `;
}

// Show error state
function showError() {
    if (!elements.favoritesGrid) return;

    elements.favoritesGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Error Loading Favorites</h3>
            <p>Please try refreshing the page</p>
            <button class="btn-primary" onclick="location.reload()">Refresh</button>
        </div>
    `;
}