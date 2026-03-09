// Reader page
import { supabase, getCurrentUser } from '../supabase.js';
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    readerHeader: document.getElementById('readerHeader'),
    mangaTitle: document.getElementById('mangaTitle'),
    chapterInfo: document.getElementById('chapterInfo'),
    readerPages: document.getElementById('readerPages'),
    progressBar: document.getElementById('progressBar'),
    prevChapter: document.getElementById('prevChapter'),
    nextChapter: document.getElementById('nextChapter'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    pageIndicator: document.getElementById('pageIndicator'),
    settingsPanel: document.getElementById('settingsPanel'),
    brightness: document.getElementById('brightness'),
    brightnessValue: document.getElementById('brightnessValue'),
    readingDirection: document.getElementById('readingDirection'),
    pageFit: document.getElementById('pageFit'),
    autoNext: document.getElementById('autoNext')
};

// State
let currentManga = null;
let currentChapter = null;
let chapters = [];
let currentPage = 1;
let totalPages = 1;
let pages = [];
let readingStartTime = Date.now();
let autoNextEnabled = true;
let currentUser = getCurrentUser();

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const mangaId = urlParams.get('manga');
const chapterId = urlParams.get('chapter');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    if (!mangaId) {
        window.location.href = 'manga.html';
        return;
    }

    await checkReadAccess();
    await loadChapter();
    setupEventListeners();
    loadSettings();
});

// Check read access
async function checkReadAccess() {
    if (!currentUser) {
        notifications.warning('Please sign in to read manga chapters');
        setTimeout(() => {
            window.location.href = 'signin.html';
        }, 1500);
        return false;
    }
    return true;
}

// Load chapter
async function loadChapter() {
    try {
        // Get manga info
        const { data: manga, error: mangaError } = await supabase
            .from('manga')
            .select('*')
            .eq('id', mangaId)
            .single();

        if (mangaError) throw mangaError;
        currentManga = manga;

        // Get all chapters
        const { data: chaptersData, error: chaptersError } = await supabase
            .from('chapters')
            .select('*')
            .eq('manga_id', mangaId)
            .order('chapter_number', { ascending: true });

        if (chaptersError) throw chaptersError;
        chapters = chaptersData;

        // Get current chapter
        let chapterQuery;
        if (chapterId) {
            chapterQuery = supabase
                .from('chapters')
                .select('*')
                .eq('id', chapterId)
                .eq('manga_id', mangaId)
                .single();
        } else {
            // Get first chapter
            chapterQuery = supabase
                .from('chapters')
                .select('*')
                .eq('manga_id', mangaId)
                .order('chapter_number', { ascending: true })
                .limit(1)
                .single();
        }

        const { data: chapter, error: chapterError } = await chapterQuery;

        if (chapterError) throw chapterError;
        currentChapter = chapter;

        // Load pages
        pages = chapter.pages || [];
        totalPages = pages.length;
        currentPage = 1;

        // Update reading history
        await updateReadingHistory();

        // Update chapter views
        await supabase
            .from('chapters')
            .update({ views: (chapter.views || 0) + 1 })
            .eq('id', chapter.id);

        displayChapter();

    } catch (error) {
        console.error('Error loading chapter:', error);
        showError();
    }
}

// Display chapter
function displayChapter() {
    if (!elements.mangaTitle || !elements.chapterInfo) return;

    // Update header
    elements.mangaTitle.textContent = currentManga.title;
    elements.chapterInfo.textContent = `Chapter ${currentChapter.chapter_number}${currentChapter.title ? ': ' + currentChapter.title : ''}`;

    if (!elements.readerPages) return;

    if (pages.length === 0) {
        elements.readerPages.innerHTML = `
            <div class="no-pages">
                <i class="fas fa-exclamation-circle"></i>
                <h3>No pages available</h3>
            </div>
        `;
        return;
    }

    elements.readerPages.innerHTML = pages.map((page, index) => `
        <div class="reader-page-image" id="page-${index + 1}" style="display: ${index + 1 === currentPage ? 'block' : 'none'};">
            <img src="${page}" alt="Page ${index + 1}" onclick="window.toggleHeader()" loading="${index === 0 ? 'eager' : 'lazy'}">
        </div>
    `).join('');

    // Load first page
    loadPageImage(1);
    updateNavigation();
    updateProgress();
}

// Load page image
function loadPageImage(pageNum) {
    const pageElement = document.getElementById(`page-${pageNum}`);
    if (!pageElement) return;

    // Preload next page
    if (pageNum < totalPages) {
        const nextImg = new Image();
        nextImg.src = pages[pageNum];
    }

    // Preload previous page
    if (pageNum > 1) {
        const prevImg = new Image();
        prevImg.src = pages[pageNum - 2];
    }

    // Show current page with animation
    setTimeout(() => {
        pageElement.classList.add('visible');
    }, 50);

    // Hide other pages
    for (let i = 1; i <= totalPages; i++) {
        if (i !== pageNum) {
            const otherPage = document.getElementById(`page-${i}`);
            if (otherPage) {
                otherPage.classList.remove('visible');
                setTimeout(() => {
                    otherPage.style.display = 'none';
                }, 300);
            }
        }
    }

    // Update URL hash
    window.location.hash = `page-${pageNum}`;
}

// Update navigation
function updateNavigation() {
    if (!elements.pageIndicator || !elements.prevPage || !elements.nextPage || 
        !elements.prevChapter || !elements.nextChapter) return;

    elements.pageIndicator.textContent = `${currentPage} / ${totalPages}`;

    // Page buttons
    elements.prevPage.disabled = currentPage === 1;
    elements.nextPage.disabled = currentPage === totalPages;

    // Chapter buttons
    const currentIndex = chapters.findIndex(c => c.id === currentChapter.id);
    elements.prevChapter.disabled = currentIndex === 0;
    elements.nextChapter.disabled = currentIndex === chapters.length - 1;
}

// Update progress
function updateProgress() {
    if (!elements.progressBar) return;
    const progress = (currentPage / totalPages) * 100;
    elements.progressBar.style.width = `${progress}%`;
}

// Update reading history
async function updateReadingHistory() {
    if (!currentUser || !currentManga || !currentChapter) return;

    await api.updateReadingHistory(
        currentUser.id,
        mangaId,
        currentChapter.id,
        currentPage,
        totalPages
    );
}

// Change page
window.changePage = function(direction) {
    if (direction === 'next' && currentPage < totalPages) {
        // Hide current page
        const currentPageEl = document.getElementById(`page-${currentPage}`);
        if (!currentPageEl) return;

        currentPageEl.classList.remove('visible');

        setTimeout(() => {
            currentPageEl.style.display = 'none';
            currentPage++;

            // Show next page
            const nextPageEl = document.getElementById(`page-${currentPage}`);
            if (nextPageEl) {
                nextPageEl.style.display = 'block';
                setTimeout(() => {
                    nextPageEl.classList.add('visible');
                }, 50);
            }

            updateNavigation();
            updateProgress();
            updateReadingHistory();

            // Check if chapter complete
            if (currentPage === totalPages) {
                checkChapterComplete();
            }
        }, 300);

    } else if (direction === 'prev' && currentPage > 1) {
        // Hide current page
        const currentPageEl = document.getElementById(`page-${currentPage}`);
        if (!currentPageEl) return;

        currentPageEl.classList.remove('visible');

        setTimeout(() => {
            currentPageEl.style.display = 'none';
            currentPage--;

            // Show previous page
            const prevPageEl = document.getElementById(`page-${currentPage}`);
            if (prevPageEl) {
                prevPageEl.style.display = 'block';
                setTimeout(() => {
                    prevPageEl.classList.add('visible');
                }, 50);
            }

            updateNavigation();
            updateProgress();
            updateReadingHistory();
        }, 300);
    }
};

// Change chapter
window.changeChapter = async function(direction) {
    const currentIndex = chapters.findIndex(c => c.id === currentChapter.id);
    let nextChapter;

    if (direction === 'next' && currentIndex < chapters.length - 1) {
        nextChapter = chapters[currentIndex + 1];
    } else if (direction === 'prev' && currentIndex > 0) {
        nextChapter = chapters[currentIndex - 1];
    } else {
        return;
    }

    // Save reading time for current chapter
    await updateReadingHistory();

    // Load next chapter
    window.location.href = `reader.html?manga=${mangaId}&chapter=${nextChapter.id}`;
};

// Check chapter complete
function checkChapterComplete() {
    if (!autoNextEnabled) return;

    // Show completion modal
    const modal = document.createElement('div');
    modal.className = 'chapter-complete';
    modal.innerHTML = `
        <h2>Chapter Complete!</h2>
        <p>You've finished Chapter ${currentChapter.chapter_number}</p>
        <div class="chapter-complete-buttons">
            <button class="chapter-complete-btn primary" onclick="window.continueToNext()">
                Next Chapter <i class="fas fa-arrow-right"></i>
            </button>
            <button class="chapter-complete-btn secondary" onclick="window.closeModal(this)">
                Read Again
            </button>
        </div>
    `;
    document.body.appendChild(modal);

    // Auto redirect after 5 seconds
    setTimeout(() => {
        if (document.querySelector('.chapter-complete')) {
            continueToNext();
        }
    }, 5000);
}

// Continue to next chapter
window.continueToNext = function() {
    closeModal();
    changeChapter('next');
};

// Close modal
window.closeModal = function(btn) {
    const modal = btn?.closest('.chapter-complete') || document.querySelector('.chapter-complete');
    if (modal) modal.remove();
};

// Toggle header
window.toggleHeader = function() {
    if (!elements.readerHeader) return;
    elements.readerHeader.classList.toggle('hidden');
};

// Toggle settings
window.toggleSettings = function() {
    if (!elements.settingsPanel) return;
    elements.settingsPanel.classList.toggle('show');
};

// Toggle fullscreen
window.toggleFullscreen = function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
};

// Adjust brightness
window.adjustBrightness = function(value) {
    document.querySelector('.reader-page').style.filter = `brightness(${value}%)`;
    if (elements.brightnessValue) {
        elements.brightnessValue.textContent = value + '%';
    }
    localStorage.setItem('readerBrightness', value);
};

// Change reading direction
window.changeDirection = function(direction) {
    const pages = document.querySelectorAll('.reader-page-image');
    pages.forEach(page => {
        page.style.direction = direction === 'rtl' ? 'rtl' : 'ltr';
    });
    localStorage.setItem('readingDirection', direction);
};

// Change page fit
window.changePageFit = function(fit) {
    const images = document.querySelectorAll('.reader-page-image img');
    images.forEach(img => {
        img.style.objectFit = fit;
    });
    localStorage.setItem('pageFit', fit);
};

// Load settings from localStorage
function loadSettings() {
    // Brightness
    const savedBrightness = localStorage.getItem('readerBrightness') || '100';
    if (elements.brightness) {
        elements.brightness.value = savedBrightness;
        adjustBrightness(savedBrightness);
    }

    // Reading direction
    const savedDirection = localStorage.getItem('readingDirection') || 'ltr';
    if (elements.readingDirection) {
        elements.readingDirection.value = savedDirection;
        changeDirection(savedDirection);
    }

    // Page fit
    const savedFit = localStorage.getItem('pageFit') || 'contain';
    if (elements.pageFit) {
        elements.pageFit.value = savedFit;
        changePageFit(savedFit);
    }

    // Auto next
    const savedAutoNext = localStorage.getItem('autoNext') !== 'false';
    if (elements.autoNext) {
        elements.autoNext.checked = savedAutoNext;
        autoNextEnabled = savedAutoNext;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            changePage('next');
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            changePage('prev');
        } else if (e.key === ' ') {
            e.preventDefault();
            toggleHeader();
        }
    });

    // Touch navigation for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, false);

    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, false);

    function handleSwipe() {
        const swipeThreshold = 50;
        const horizontalDiff = touchEndX - touchStartX;
        const verticalDiff = touchEndY - touchStartY;

        if (Math.abs(horizontalDiff) > Math.abs(verticalDiff)) {
            // Horizontal swipe
            if (horizontalDiff > swipeThreshold) {
                // Swipe right - previous page
                changePage('prev');
            } else if (horizontalDiff < -swipeThreshold) {
                // Swipe left - next page
                changePage('next');
            }
        } else {
            // Vertical swipe
            if (verticalDiff > swipeThreshold) {
                // Swipe down - toggle header
                toggleHeader();
            } else if (verticalDiff < -swipeThreshold) {
                // Swipe up - toggle header
                toggleHeader();
            }
        }
    }

    // Settings changes
    if (elements.brightness) {
        elements.brightness.addEventListener('input', (e) => {
            adjustBrightness(e.target.value);
        });
    }

    if (elements.readingDirection) {
        elements.readingDirection.addEventListener('change', (e) => {
            changeDirection(e.target.value);
        });
    }

    if (elements.pageFit) {
        elements.pageFit.addEventListener('change', (e) => {
            changePageFit(e.target.value);
        });
    }

    if (elements.autoNext) {
        elements.autoNext.addEventListener('change', (e) => {
            autoNextEnabled = e.target.checked;
            localStorage.setItem('autoNext', autoNextEnabled);
        });
    }
}

// Show error
function showError() {
    if (!elements.readerPages) return;

    elements.readerPages.innerHTML = `
        <div class="error-container">
            <i class="fas fa-exclamation-circle"></i>
            <h2>Chapter not found</h2>
            <p>The chapter you're looking for doesn't exist or has been removed.</p>
            <a href="manga-details.html?id=${mangaId}" class="btn-primary">Back to Manga</a>
        </div>
    `;
}