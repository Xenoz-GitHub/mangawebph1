// Manga Import from MangaDex
import { supabase, getCurrentUser } from '../../supabase.js';
import notifications from '../../notifications.js';
import { Utils } from '../../utils.js';

// DOM Elements
const elements = {
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    demographic: document.getElementById('demographic'),
    status: document.getElementById('status'),
    sort: document.getElementById('sort'),
    resultsGrid: document.getElementById('resultsGrid'),
    selectedManga: document.getElementById('selectedManga'),
    mangaDetails: document.getElementById('mangaDetails'),
    chaptersList: document.getElementById('chaptersList'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    importBtn: document.getElementById('importBtn'),
    importProgress: document.getElementById('importProgress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText')
};

// State
let currentManga = null;
let selectedChapters = new Set();
let chapters = [];
let importQueue = [];
let isImporting = false;

// MangaDex API Base URL
const MANGADEX_API = 'https://api.mangadex.org';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkAdminAccess();
});

// Check admin access
async function checkAdminAccess() {
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', getCurrentUser()?.id)
        .single();

    if (!profile?.is_admin) {
        notifications.error('Access denied');
        window.location.href = '../index.html';
    }
}

// Setup event listeners
function setupEventListeners() {
    if (elements.searchBtn) {
        elements.searchBtn.addEventListener('click', searchManga);
    }

    if (elements.searchInput) {
        elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchManga();
        });
    }

    if (elements.selectAllBtn) {
        elements.selectAllBtn.addEventListener('click', toggleSelectAll);
    }

    if (elements.importBtn) {
        elements.importBtn.addEventListener('click', startImport);
    }
}

// Search manga from MangaDex
async function searchManga() {
    const query = elements.searchInput?.value.trim();
    if (!query) {
        notifications.warning('Please enter a search term');
        return;
    }

    showLoading();

    try {
        const params = new URLSearchParams({
            title: query,
            limit: '20',
            'includes[]': 'cover_art'
        });

        // Add filters
        if (elements.demographic?.value) {
            params.append('publicationDemographic[]', elements.demographic.value);
        }
        if (elements.status?.value) {
            params.append('status[]', elements.status.value);
        }
        if (elements.sort?.value) {
            params.append('order[relevance]', 'desc');
        }

        const response = await fetch(`${MANGADEX_API}/manga?${params}`);
        const data = await response.json();

        if (data.errors) {
            throw new Error(data.errors[0].title);
        }

        displayResults(data.data);

    } catch (error) {
        console.error('Error searching manga:', error);
        notifications.error('Failed to search manga');
    } finally {
        hideLoading();
    }
}

// Display search results
function displayResults(mangaList) {
    if (!elements.resultsGrid) return;

    if (!mangaList || mangaList.length === 0) {
        elements.resultsGrid.innerHTML = '<p class="no-results">No manga found</p>';
        return;
    }

    elements.resultsGrid.innerHTML = mangaList.map(manga => {
        const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0];
        const coverUrl = getCoverUrl(manga);
        const year = manga.attributes.year || 'N/A';
        const status = manga.attributes.status || 'unknown';

        return `
            <div class="import-card" onclick="selectManga('${manga.id}')">
                <img src="${coverUrl}" alt="${title}" onerror="this.src='../../images/no-cover.jpg'">
                <div class="import-info">
                    <div class="import-title">${Utils.escapeHtml(title)}</div>
                    <div class="import-meta">
                        <span><i class="fas fa-calendar"></i> ${year}</span>
                        <span><i class="fas fa-circle ${status}"></i> ${status}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Get cover URL from MangaDex
function getCoverUrl(manga) {
    try {
        const coverArt = manga.relationships?.find(r => r.type === 'cover_art');
        if (coverArt?.attributes?.fileName) {
            return `https://uploads.mangadex.org/covers/${manga.id}/${coverArt.attributes.fileName}`;
        }
    } catch (error) {
        console.error('Error getting cover URL:', error);
    }
    return '../../images/no-cover.jpg';
}

// Select manga for import
window.selectManga = async function(mangaId) {
    showLoading();

    try {
        // Fetch manga details
        const [mangaRes, chaptersRes] = await Promise.all([
            fetch(`${MANGADEX_API}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`),
            fetch(`${MANGADEX_API}/manga/${mangaId}/feed?translatedLanguage[]=en&order[chapter]=asc&limit=500`)
        ]);

        const mangaData = await mangaRes.json();
        const chaptersData = await chaptersRes.json();

        if (mangaData.errors || chaptersData.errors) {
            throw new Error('Failed to fetch manga details');
        }

        currentManga = mangaData.data;
        chapters = chaptersData.data || [];

        displayMangaDetails(mangaData.data, chapters);

    } catch (error) {
        console.error('Error selecting manga:', error);
        notifications.error('Failed to load manga details');
    } finally {
        hideLoading();
    }
};

// Display manga details
function displayMangaDetails(manga, chapters) {
    if (!elements.selectedManga || !elements.mangaDetails || !elements.chaptersList) return;

    const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0];
    const description = manga.attributes.description?.en || 'No description available';
    const coverUrl = getCoverUrl(manga);
    const author = manga.relationships?.find(r => r.type === 'author')?.attributes?.name || 'Unknown';
    const artist = manga.relationships?.find(r => r.type === 'artist')?.attributes?.name || 'Unknown';
    const status = manga.attributes.status || 'unknown';
    const year = manga.attributes.year || 'N/A';

    elements.selectedManga.style.display = 'block';

    elements.mangaDetails.innerHTML = `
        <img src="${coverUrl}" alt="${title}">
        <div>
            <h3>${Utils.escapeHtml(title)}</h3>
            <p><strong>Author:</strong> ${Utils.escapeHtml(author)}</p>
            <p><strong>Artist:</strong> ${Utils.escapeHtml(artist)}</p>
            <p><strong>Status:</strong> <span class="status-${status}">${status}</span></p>
            <p><strong>Year:</strong> ${year}</p>
            <p><strong>Chapters:</strong> ${chapters.length}</p>
            <p class="description">${Utils.truncateText(Utils.escapeHtml(description), 300)}</p>
        </div>
    `;

    // Display chapters
    if (chapters.length === 0) {
        elements.chaptersList.innerHTML = '<p class="no-chapters">No chapters available</p>';
    } else {
        elements.chaptersList.innerHTML = chapters.map(ch => {
            const chapterNum = ch.attributes.chapter || '0';
            const chapterTitle = ch.attributes.title || `Chapter ${chapterNum}`;
            const pages = ch.attributes.pages || 0;
            const translatedLanguage = ch.attributes.translatedLanguage || 'en';

            return `
                <div class="chapter-item">
                    <label class="chapter-checkbox">
                        <input type="checkbox" class="chapter-select" 
                               value="${ch.id}" 
                               data-chapter="${chapterNum}" 
                               data-title="${chapterTitle}"
                               data-pages="${pages}"
                               data-lang="${translatedLanguage}">
                        <div class="chapter-info">
                            <span class="chapter-number">Chapter ${chapterNum}</span>
                            <span class="chapter-title">${Utils.escapeHtml(chapterTitle)}</span>
                            <span class="chapter-meta">
                                <i class="fas fa-file-image"></i> ${pages} pages
                                <i class="fas fa-language"></i> ${translatedLanguage}
                            </span>
                        </div>
                    </label>
                </div>
            `;
        }).join('');

        // Add event listeners to checkboxes
        document.querySelectorAll('.chapter-select').forEach(cb => {
            cb.addEventListener('change', updateSelectedChapters);
        });
    }

    selectedChapters.clear();
    updateSelectAllButton();
}

// Update selected chapters
function updateSelectedChapters() {
    selectedChapters.clear();
    document.querySelectorAll('.chapter-select:checked').forEach(cb => {
        selectedChapters.add({
            id: cb.value,
            number: cb.dataset.chapter,
            title: cb.dataset.title,
            pages: parseInt(cb.dataset.pages),
            lang: cb.dataset.lang
        });
    });

    updateSelectAllButton();
}

// Toggle select all chapters
function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.chapter-select');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);

    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });

    updateSelectedChapters();
}

// Update select all button text
function updateSelectAllButton() {
    if (!elements.selectAllBtn) return;

    const checkboxes = document.querySelectorAll('.chapter-select');
    const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    
    elements.selectAllBtn.textContent = allChecked ? 'Deselect All' : 'Select All';
}

// Start import process
async function startImport() {
    if (selectedChapters.size === 0) {
        notifications.warning('Please select chapters to import');
        return;
    }

    if (!currentManga) return;

    isImporting = true;
    elements.importBtn.disabled = true;
    elements.importProgress.style.display = 'block';

    const chaptersArray = Array.from(selectedChapters);
    let imported = 0;
    let failed = 0;

    try {
        // First, insert or get manga
        const mangaId = await importManga(currentManga);

        if (!mangaId) {
            throw new Error('Failed to import manga');
        }

        // Import selected chapters
        for (const chapter of chaptersArray) {
            try {
                const success = await importChapter(mangaId, chapter);
                if (success) {
                    imported++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error('Error importing chapter:', error);
                failed++;
            }

            // Update progress
            const progress = ((imported + failed) / chaptersArray.length) * 100;
            elements.progressFill.style.width = `${progress}%`;
            elements.progressText.textContent = `Imported: ${imported}, Failed: ${failed}`;
        }

        // Show result
        if (failed === 0) {
            notifications.success(`Successfully imported ${imported} chapters!`);
        } else {
            notifications.warning(`Imported ${imported} chapters, ${failed} failed`);
        }

        // Reset UI
        setTimeout(() => {
            elements.selectedManga.style.display = 'none';
            elements.importProgress.style.display = 'none';
            selectedChapters.clear();
        }, 3000);

    } catch (error) {
        console.error('Error during import:', error);
        notifications.error('Import failed');
    } finally {
        isImporting = false;
        elements.importBtn.disabled = false;
    }
}

// Import manga to database
async function importManga(manga) {
    try {
        const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0];
        const description = manga.attributes.description?.en || '';
        const coverUrl = getCoverUrl(manga);
        const author = manga.relationships?.find(r => r.type === 'author')?.attributes?.name || 'Unknown';
        const artist = manga.relationships?.find(r => r.type === 'artist')?.attributes?.name || 'Unknown';
        const status = manga.attributes.status || 'ongoing';
        const year = manga.attributes.year || null;
        const genres = manga.attributes.tags
            ?.filter(tag => tag.attributes.group === 'genre')
            .map(tag => tag.attributes.name.en) || [];

        // Check if manga already exists
        const { data: existing } = await supabase
            .from('manga')
            .select('id')
            .eq('title', title)
            .maybeSingle();

        if (existing) {
            return existing.id;
        }

        // Insert new manga
        const { data, error } = await supabase
            .from('manga')
            .insert([{
                title,
                description,
                cover_url: coverUrl,
                author,
                artist,
                status,
                release_year: year,
                genres,
                source: 'mangadex',
                source_id: manga.id,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;
        return data.id;

    } catch (error) {
        console.error('Error importing manga:', error);
        return null;
    }
}

// Import chapter from MangaDex
async function importChapter(mangaId, chapter) {
    try {
        // Check if chapter already exists
        const { data: existing } = await supabase
            .from('chapters')
            .select('id')
            .eq('manga_id', mangaId)
            .eq('chapter_number', parseFloat(chapter.number))
            .maybeSingle();

        if (existing) {
            console.log(`Chapter ${chapter.number} already exists, skipping`);
            return true;
        }

        // Get chapter pages from MangaDex
        const response = await fetch(`${MANGADEX_API}/at-home/server/${chapter.id}`);
        const data = await response.json();

        if (!data.chapter?.data) {
            throw new Error('No pages data');
        }

        const pages = data.chapter.data.map(page => 
            `${data.baseUrl}/data/${data.chapter.hash}/${page}`
        );

        // Insert chapter
        const { error } = await supabase
            .from('chapters')
            .insert([{
                manga_id: mangaId,
                chapter_number: parseFloat(chapter.number),
                title: chapter.title,
                pages: pages,
                source: 'mangadex',
                source_id: chapter.id,
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;

        // Update manga's latest chapter
        await supabase.rpc('update_manga_latest_chapter', {
            p_manga_id: mangaId,
            p_chapter: parseFloat(chapter.number)
        });

        return true;

    } catch (error) {
        console.error('Error importing chapter:', error);
        return false;
    }
}

// Show loading
function showLoading() {
    if (elements.resultsGrid) {
        elements.resultsGrid.innerHTML = `
            <div class="admin-loading">
                <div class="admin-loading-spinner"></div>
                <p>Searching...</p>
            </div>
        `;
    }
}

// Hide loading
function hideLoading() {
    // Loading hidden by results
}

// Import from URL (for other sources)
window.importFromUrl = async function() {
    const url = prompt('Enter manga URL (MangaDex, MangaFox, etc.):');
    if (!url) return;

    try {
        notifications.info('Importing from URL...');
        
        // Parse source from URL
        if (url.includes('mangadex.org')) {
            const mangaId = url.split('/').pop();
            await selectManga(mangaId);
        } else {
            notifications.error('Unsupported source');
        }

    } catch (error) {
        console.error('Error importing from URL:', error);
        notifications.error('Failed to import from URL');
    }
};