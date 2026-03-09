// Search page
import { supabase } from '../supabase.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    searchSuggestions: document.getElementById('searchSuggestions'),
    recentTags: document.getElementById('recentTags'),
    genreFilter: document.getElementById('genreFilter'),
    statusFilter: document.getElementById('statusFilter'),
    ratingFilter: document.getElementById('ratingFilter'),
    yearFilter: document.getElementById('yearFilter'),
    sortBy: document.getElementById('sortBy'),
    resultsGrid: document.getElementById('resultsGrid'),
    resultCount: document.getElementById('resultCount'),
    loadMoreBtn: document.getElementById('loadMoreBtn'),
    applyFiltersBtn: document.querySelector('.apply-filters'),
    resetFiltersBtn: document.querySelector('.reset-filters')
};

// State
let currentPage = 1;
let totalResults = 0;
let currentQuery = '';
let currentFilters = {};
let currentSort = 'relevance';
let searchTimeout;
let isLoading = false;
const ITEMS_PER_PAGE = 24;

// Recent searches from localStorage
let recentSearches = JSON.parse(localStorage.getItem('recentSearches')) || [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    displayRecentSearches();
    setupEventListeners();

    // Check for query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('q');
    if (initialQuery) {
        if (elements.searchInput) {
            elements.searchInput.value = initialQuery;
        }
        performSearch(true);
    }
});

// Setup event listeners
function setupEventListeners() {
    // Search input with debounce
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            const query = e.target.value;

            if (query.length < 2) {
                if (elements.searchSuggestions) {
                    elements.searchSuggestions.classList.remove('show');
                }
                return;
            }

            searchTimeout = setTimeout(() => {
                getSuggestions(query);
            }, 300);
        });

        elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch(true);
                if (elements.searchSuggestions) {
                    elements.searchSuggestions.classList.remove('show');
                }
            }
        });
    }

    // Search button
    if (elements.searchBtn) {
        elements.searchBtn.addEventListener('click', () => {
            performSearch(true);
        });
    }

    // Apply filters
    if (elements.applyFiltersBtn) {
        elements.applyFiltersBtn.addEventListener('click', applyFilters);
    }

    // Reset filters
    if (elements.resetFiltersBtn) {
        elements.resetFiltersBtn.addEventListener('click', resetFilters);
    }

    // Sort change
    if (elements.sortBy) {
        elements.sortBy.addEventListener('change', () => {
            currentSort = elements.sortBy.value;
            performSearch(true);
        });
    }

    // Load more
    if (elements.loadMoreBtn) {
        elements.loadMoreBtn.addEventListener('click', () => {
            loadMore();
        });
    }

    // Click outside to close suggestions
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box') && elements.searchSuggestions) {
            elements.searchSuggestions.classList.remove('show');
        }
    });
}

// Display recent searches
function displayRecentSearches() {
    if (!elements.recentTags) return;

    if (recentSearches.length === 0) {
        elements.recentTags.innerHTML = '<p class="no-data">No recent searches</p>';
        return;
    }

    elements.recentTags.innerHTML = recentSearches.map(search => `
        <span class="recent-tag" onclick="searchFromHistory('${search}')">
            <i class="fas fa-search"></i> ${Utils.escapeHtml(search)}
        </span>
    `).join('');
}

// Add to recent searches
function addToRecentSearches(query) {
    if (!query.trim()) return;

    // Remove if already exists
    recentSearches = recentSearches.filter(s => s !== query);

    // Add to front
    recentSearches.unshift(query);

    // Keep only last 10
    if (recentSearches.length > 10) {
        recentSearches.pop();
    }

    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    displayRecentSearches();
}

// Get search suggestions
async function getSuggestions(query) {
    if (!elements.searchSuggestions) return;

    try {
        const { data: suggestions, error } = await supabase
            .from('manga')
            .select('title')
            .ilike('title', `%${query}%`)
            .limit(5);

        if (error) throw error;

        if (!suggestions || suggestions.length === 0) {
            elements.searchSuggestions.innerHTML = `
                <div class="suggestion-item">
                    <i class="fas fa-search"></i>
                    <span>No suggestions found</span>
                </div>
            `;
        } else {
            elements.searchSuggestions.innerHTML = suggestions.map(s => `
                <div class="suggestion-item" onclick="searchFromSuggestion('${s.title}')">
                    <i class="fas fa-history"></i>
                    <span>${Utils.escapeHtml(s.title)}</span>
                    <span class="suggestion-category">Manga</span>
                </div>
            `).join('');
        }

        elements.searchSuggestions.classList.add('show');

    } catch (error) {
        console.error('Error getting suggestions:', error);
    }
}

// Search from suggestion
window.searchFromSuggestion = function(query) {
    if (elements.searchInput) {
        elements.searchInput.value = query;
    }
    if (elements.searchSuggestions) {
        elements.searchSuggestions.classList.remove('show');
    }
    performSearch(true);
};

// Search from history
window.searchFromHistory = function(query) {
    if (elements.searchInput) {
        elements.searchInput.value = query;
    }
    performSearch(true);
};

// Apply filters
function applyFilters() {
    currentFilters = {
        genre: elements.genreFilter?.value,
        status: elements.statusFilter?.value,
        rating: elements.ratingFilter?.value,
        year: elements.yearFilter?.value
    };
    performSearch(true);
}

// Reset filters
function resetFilters() {
    if (elements.genreFilter) elements.genreFilter.value = '';
    if (elements.statusFilter) elements.statusFilter.value = '';
    if (elements.ratingFilter) elements.ratingFilter.value = '';
    if (elements.yearFilter) elements.yearFilter.value = '';
    currentFilters = {};
    performSearch(true);
}

// Perform search
async function performSearch(reset = true) {
    const query = elements.searchInput?.value || '';

    if (!query && Object.keys(currentFilters).length === 0) {
        if (elements.resultsGrid) {
            elements.resultsGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <h3>Start searching</h3>
                    <p>Enter a search term or use filters to find manga</p>
                </div>
            `;
        }
        if (elements.resultCount) {
            elements.resultCount.textContent = '0';
        }
        return;
    }

    if (reset) {
        currentPage = 1;
        if (query) {
            addToRecentSearches(query);
        }
        currentQuery = query;
        showLoading();
    }

    try {
        let dbQuery = supabase
            .from('manga')
            .select('*', { count: 'exact' });

        // Apply search query
        if (query) {
            dbQuery = dbQuery.ilike('title', `%${query}%`);
        }

        // Apply filters
        if (currentFilters.genre) {
            dbQuery = dbQuery.contains('genres', [currentFilters.genre]);
        }

        if (currentFilters.status) {
            dbQuery = dbQuery.eq('status', currentFilters.status);
        }

        if (currentFilters.rating) {
            dbQuery = dbQuery.gte('rating', parseInt(currentFilters.rating));
        }

        if (currentFilters.year) {
            dbQuery = dbQuery.eq('release_year', currentFilters.year);
        }

        // Apply sorting
        switch(currentSort) {
            case 'latest':
                dbQuery = dbQuery.order('created_at', { ascending: false });
                break;
            case 'popular':
                dbQuery = dbQuery.order('views', { ascending: false });
                break;
            case 'rating':
                dbQuery = dbQuery.order('rating', { ascending: false });
                break;
            case 'title':
                dbQuery = dbQuery.order('title', { ascending: true });
                break;
            default:
                dbQuery = dbQuery.order('title');
        }

        // Pagination
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        dbQuery = dbQuery.range(from, to);

        const { data: results, count, error } = await dbQuery;

        if (error) throw error;

        totalResults = count || 0;

        displayResults(results, reset);

        // Update load more button
        if (elements.loadMoreBtn) {
            const hasMore = (currentPage * ITEMS_PER_PAGE) < totalResults;
            elements.loadMoreBtn.style.display = hasMore ? 'block' : 'none';
        }

    } catch (error) {
        console.error('Error searching:', error);
        notifications.error('Failed to search manga');
    } finally {
        hideLoading();
    }
}

// Display results
function displayResults(results, reset) {
    if (!elements.resultsGrid || !elements.resultCount) return;

    elements.resultCount.textContent = totalResults || 0;

    if (!results || results.length === 0) {
        if (reset) {
            elements.resultsGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-frown"></i>
                    <h3>No results found</h3>
                    <p>Try different keywords or remove filters</p>
                </div>
            `;
        }
        return;
    }

    const resultsHtml = results.map(manga => `
        <div class="manga-card" onclick="window.location.href='manga-details.html?id=${manga.id}'">
            <img src="${manga.cover_url || 'images/no-cover.jpg'}" alt="${Utils.escapeHtml(manga.title)}">
            <div class="manga-info">
                <h3 class="manga-title">${highlightMatch(manga.title, currentQuery)}</h3>
                <div class="manga-meta">
                    <span><i class="fas fa-star" style="color: gold;"></i> ${manga.rating?.toFixed(1) || 'N/A'}</span>
                    <span><i class="fas fa-eye"></i> ${Utils.formatNumber(manga.views || 0)}</span>
                </div>
            </div>
        </div>
    `).join('');

    if (reset) {
        elements.resultsGrid.innerHTML = resultsHtml;
    } else {
        elements.resultsGrid.insertAdjacentHTML('beforeend', resultsHtml);
    }
}

// Highlight matching text
function highlightMatch(text, query) {
    if (!query) return Utils.escapeHtml(text);
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="match-highlight">$1</span>');
}

// Load more results
function loadMore() {
    currentPage++;
    performSearch(false);
}

// Show loading
function showLoading() {
    if (!elements.resultsGrid) return;

    isLoading = true;
    if (currentPage === 1) {
        elements.resultsGrid.innerHTML = `
            <div class="loading-skeleton">
                ${Array(8).fill('<div class="skeleton-card"></div>').join('')}
            </div>
        `;
    }
}

// Hide loading
function hideLoading() {
    isLoading = false;
}