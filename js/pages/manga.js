// Manga library page
import { supabase } from '../supabase.js';
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    mangaGrid: document.getElementById('mangaGrid'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    filterSection: document.getElementById('filterSection'),
    sortSelect: document.getElementById('sortSelect'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    pageInfo: document.getElementById('pageInfo'),
    loadingSkeleton: document.getElementById('loadingSkeleton')
};

// State
let currentPage = 1;
let totalPages = 1;
let currentFilter = 'all';
let currentSort = 'latest';
let searchQuery = '';
let isLoading = false;
const ITEMS_PER_PAGE = 24;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadManga(true);
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search
    if (elements.searchBtn) {
        elements.searchBtn.addEventListener('click', () => {
            searchQuery = elements.searchInput.value;
            loadManga(true);
        });
    }

    if (elements.searchInput) {
        elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchQuery = e.target.value;
                loadManga(true);
            }
        });
    }

    // Filter buttons
    if (elements.filterSection) {
        elements.filterSection.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                elements.filterSection.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                loadManga(true);
            });
        });
    }

    // Sort
    if (elements.sortSelect) {
        elements.sortSelect.addEventListener('change', function() {
            currentSort = this.value;
            loadManga(true);
        });
    }

    // Pagination
    if (elements.prevPage) {
        elements.prevPage.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadManga(false);
            }
        });
    }

    if (elements.nextPage) {
        elements.nextPage.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadManga(false);
            }
        });
    }
}

// Load manga
async function loadManga(reset = true) {
    if (isLoading) return;
    
    isLoading = true;
    
    if (reset) {
        currentPage = 1;
        showSkeleton();
    }

    try {
        const filters = {
            search: searchQuery,
            sort: currentSort
        };

        // Apply genre filter
        if (currentFilter !== 'all') {
            filters.genre = currentFilter;
        }

        const { data: manga, count, error } = await supabase
            .from('manga')
            .select('*', { count: 'exact' })
            .order(getSortField(currentSort), { ascending: currentSort === 'title' ? true : false });

        // Apply search filter manually if needed
        let filteredManga = manga || [];
        if (searchQuery) {
            filteredManga = filteredManga.filter(m => 
                m.title.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Apply genre filter
        if (currentFilter !== 'all' && filteredManga.length > 0) {
            filteredManga = filteredManga.filter(m => 
                m.genres && m.genres.includes(currentFilter)
            );
        }

        // Calculate pagination
        totalPages = Math.ceil(filteredManga.length / ITEMS_PER_PAGE);
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const paginatedManga = filteredManga.slice(start, end);

        displayManga(paginatedManga);
        updatePagination();

    } catch (error) {
        console.error('Error loading manga:', error);
        notifications.error('Failed to load manga');
        showError();
    } finally {
        isLoading = false;
    }
}

// Get sort field
function getSortField(sort) {
    switch(sort) {
        case 'latest': return 'created_at';
        case 'popular': return 'views';
        case 'rating': return 'rating';
        case 'title': return 'title';
        default: return 'created_at';
    }
}

// Show skeleton loading
function showSkeleton() {
    if (!elements.mangaGrid) return;
    
    elements.mangaGrid.innerHTML = `
        <div class="loading-skeleton">
            ${Array(12).fill('<div class="skeleton-card"></div>').join('')}
        </div>
    `;
}

// Display manga
function displayManga(manga) {
    if (!elements.mangaGrid) return;

    if (!manga || manga.length === 0) {
        elements.mangaGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>No manga found</h3>
                <p>Try adjusting your search or filters</p>
            </div>
        `;
        return;
    }

    elements.mangaGrid.innerHTML = manga.map((m, index) => `
        <div class="manga-card" onclick="window.location.href='manga-details.html?id=${m.id}'" style="animation-delay: ${index * 0.05}s">
            <img src="${m.cover_url || 'images/no-cover.jpg'}" alt="${Utils.escapeHtml(m.title)}" loading="lazy">
            <div class="manga-info">
                <h3 class="manga-title">${Utils.escapeHtml(m.title)}</h3>
                <div class="manga-meta">
                    <span class="manga-rating">
                        <i class="fas fa-star" style="color: gold;"></i> ${m.rating?.toFixed(1) || 'N/A'}
                    </span>
                    <span><i class="fas fa-eye"></i> ${Utils.formatNumber(m.views || 0)}</span>
                </div>
                <div class="manga-chapter">
                    <i class="fas fa-book-open"></i> Chapter ${m.latest_chapter || 1}
                </div>
            </div>
        </div>
    `).join('');
}

// Update pagination
function updatePagination() {
    if (!elements.pageInfo || !elements.prevPage || !elements.nextPage) return;

    elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    elements.prevPage.disabled = currentPage === 1;
    elements.nextPage.disabled = currentPage === totalPages;
}

// Show error
function showError() {
    if (!elements.mangaGrid) return;
    
    elements.mangaGrid.innerHTML = `
        <div class="no-results">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Error loading manga</h3>
            <p>Please try again later</p>
        </div>
    `;
}

// Infinite scroll for mobile
let scrollTimeout;
window.addEventListener('scroll', () => {
    if (window.innerWidth > 768) return;
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        const scrollPosition = window.innerHeight + window.scrollY;
        const threshold = document.body.offsetHeight - 1000;
        
        if (scrollPosition >= threshold && !isLoading && currentPage < totalPages) {
            currentPage++;
            loadManga(false);
        }
    }, 200);
});

// Quick download from manga grid
window.quickDownload = async function(mangaId, event) {
    event.stopPropagation();

    if (!currentUser) {
        notifications.warning('Please sign in to download');
        window.location.href = 'signin.html';
        return;
    }

    // Check limit
    const { data: limitCheck } = await supabase
        .rpc('check_download_limit', {
            p_user_id: currentUser.id,
            p_manga_id: mangaId
        });

    if (!limitCheck.allowed) {
        alert(limitCheck.message);
        return;
    }

    // Redirect to manga details for full download
    window.location.href = `manga-details.html?id=${mangaId}`;
};