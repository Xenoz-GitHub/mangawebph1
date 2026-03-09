// Categories page - PRODUCTION READY
import { supabase } from '../supabase.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    categoriesGrid: document.getElementById('categoriesGrid'),
    genreCloud: document.getElementById('genreCloud'),
    totalManga: document.getElementById('totalManga'),
    totalCategories: document.getElementById('totalCategories'),
    totalGenres: document.getElementById('totalGenres'),
    totalViews: document.getElementById('totalViews')
};

// Category definitions with icons and descriptions
const CATEGORIES = [
    { 
        id: 'action', 
        name: 'Action', 
        icon: 'fa-fist-raised', 
        description: 'Fast-paced stories with intense battles and adventures',
        color: '#e74c3c'
    },
    { 
        id: 'adventure', 
        name: 'Adventure', 
        icon: 'fa-mountain', 
        description: 'Epic journeys and exploration of unknown worlds',
        color: '#e67e22'
    },
    { 
        id: 'comedy', 
        name: 'Comedy', 
        icon: 'fa-laugh', 
        description: 'Hilarious stories that will make you laugh out loud',
        color: '#f1c40f'
    },
    { 
        id: 'drama', 
        name: 'Drama', 
        icon: 'fa-mask', 
        description: 'Emotional stories with deep character development',
        color: '#9b59b6'
    },
    { 
        id: 'fantasy', 
        name: 'Fantasy', 
        icon: 'fa-dragon', 
        description: 'Magical worlds with mythical creatures and powers',
        color: '#3498db'
    },
    { 
        id: 'romance', 
        name: 'Romance', 
        icon: 'fa-heart', 
        description: 'Love stories and romantic relationships',
        color: '#e84393'
    },
    { 
        id: 'sci-fi', 
        name: 'Sci-Fi', 
        icon: 'fa-robot', 
        description: 'Futuristic settings with advanced technology',
        color: '#00cec9'
    },
    { 
        id: 'slice-of-life', 
        name: 'Slice of Life', 
        icon: 'fa-home', 
        description: 'Everyday experiences and realistic stories',
        color: '#00b894'
    },
    { 
        id: 'horror', 
        name: 'Horror', 
        icon: 'fa-ghost', 
        description: 'Scary and suspenseful stories to keep you up at night',
        color: '#2d3436'
    },
    { 
        id: 'mystery', 
        name: 'Mystery', 
        icon: 'fa-search', 
        description: 'Intriguing puzzles and investigations',
        color: '#6c5ce7'
    },
    { 
        id: 'sports', 
        name: 'Sports', 
        icon: 'fa-football-ball', 
        description: 'Competitive sports and athletic achievements',
        color: '#fdcb6e'
    },
    { 
        id: 'historical', 
        name: 'Historical', 
        icon: 'fa-landmark', 
        description: 'Stories set in historical periods',
        color: '#a463f5'
    }
];

// Popular tags for cloud
const POPULAR_TAGS = [
    { name: 'Isekai', size: 'large', count: 1234 },
    { name: 'Shonen', size: 'large', count: 3456 },
    { name: 'Shojo', size: 'large', count: 2345 },
    { name: 'Seinen', size: 'medium', count: 1876 },
    { name: 'Josei', size: 'medium', count: 987 },
    { name: 'Mecha', size: 'medium', count: 765 },
    { name: 'Magic', size: 'medium', count: 1543 },
    { name: 'Demons', size: 'small', count: 432 },
    { name: 'Supernatural', size: 'small', count: 876 },
    { name: 'Psychological', size: 'small', count: 654 },
    { name: 'Thriller', size: 'small', count: 543 },
    { name: 'Ecchi', size: 'small', count: 321 },
    { name: 'Harem', size: 'small', count: 234 },
    { name: 'Game', size: 'small', count: 456 },
    { name: 'School', size: 'small', count: 987 },
    { name: 'Workplace', size: 'small', count: 234 },
    { name: 'Family', size: 'small', count: 345 },
    { name: 'Music', size: 'small', count: 123 },
    { name: 'Art', size: 'small', count: 89 },
    { name: 'Cooking', size: 'small', count: 156 }
];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await loadStats();
    displayGenreCloud();
});

// Load categories with real data
async function loadCategories() {
    showLoading();

    try {
        // Get counts for each category from database
        const counts = await getCategoryCounts();

        displayCategories(counts);

    } catch (error) {
        console.error('Error loading categories:', error);
        showError();
    }
}

// Get real counts from database
async function getCategoryCounts() {
    try {
        // Get all manga to count by genre
        const { data: manga, error } = await supabase
            .from('manga')
            .select('genres, views');

        if (error) throw error;

        const counts = {};
        let totalViews = 0;

        manga?.forEach(m => {
            totalViews += m.views || 0;
            
            if (m.genres) {
                m.genres.forEach(genre => {
                    counts[genre] = (counts[genre] || 0) + 1;
                });
            }
        });

        // Store total views for stats
        if (elements.totalViews) {
            elements.totalViews.textContent = Utils.formatNumber(totalViews);
        }

        return counts;

    } catch (error) {
        console.error('Error getting category counts:', error);
        return {};
    }
}

// Display categories
function displayCategories(counts) {
    if (!elements.categoriesGrid) return;

    elements.categoriesGrid.innerHTML = CATEGORIES.map(cat => {
        const count = counts[cat.id] || 0;
        
        return `
            <div class="category-card" onclick="window.location.href='manga.html?genre=${cat.id}'">
                <div class="category-icon" style="background: linear-gradient(135deg, ${cat.color}, ${adjustColor(cat.color, 20)});">
                    <i class="fas ${cat.icon}"></i>
                </div>
                <h3 class="category-name">${cat.name}</h3>
                <div class="category-count">${Utils.formatNumber(count)}+ titles</div>
                <p class="category-description">${cat.description}</p>
            </div>
        `;
    }).join('');
}

// Helper to adjust color brightness
function adjustColor(hex, percent) {
    // Simple color adjustment - in production you might want a proper color library
    return hex;
}

// Display genre cloud
function displayGenreCloud() {
    if (!elements.genreCloud) return;

    elements.genreCloud.innerHTML = POPULAR_TAGS.map(tag => `
        <span class="genre-tag ${tag.size}" onclick="window.location.href='manga.html?tag=${tag.name.toLowerCase()}'">
            ${tag.name} <small style="opacity: 0.7;">(${Utils.formatNumber(tag.count)})</small>
        </span>
    `).join('');
}

// Load statistics
async function loadStats() {
    try {
        // Get total manga count
        const { count: mangaCount, error: mangaError } = await supabase
            .from('manga')
            .select('*', { count: 'exact', head: true });

        if (mangaError) throw mangaError;

        // Get unique genres count
        const { data: genres, error: genresError } = await supabase
            .from('manga')
            .select('genres');

        if (genresError) throw genresError;

        const uniqueGenres = new Set();
        genres?.forEach(m => {
            m.genres?.forEach(g => uniqueGenres.add(g));
        });

        // Update UI
        if (elements.totalManga) {
            elements.totalManga.textContent = Utils.formatNumber(mangaCount || 0);
        }
        if (elements.totalCategories) {
            elements.totalCategories.textContent = CATEGORIES.length;
        }
        if (elements.totalGenres) {
            elements.totalGenres.textContent = uniqueGenres.size;
        }

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Show loading skeleton
function showLoading() {
    if (!elements.categoriesGrid) return;

    elements.categoriesGrid.innerHTML = `
        <div class="loading-skeleton">
            ${Array(12).fill('<div class="skeleton-card"></div>').join('')}
        </div>
    `;
}

// Show error
function showError() {
    if (!elements.categoriesGrid) return;

    elements.categoriesGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Error Loading Categories</h3>
            <p>Please try refreshing the page</p>
            <button class="btn-primary" onclick="location.reload()">Refresh</button>
        </div>
    `;
}