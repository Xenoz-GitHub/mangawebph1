// Downloads page
import { supabase, getCurrentUser, onAuthChange } from '../supabase.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    downloadsGrid: document.getElementById('downloadsGrid'),
    mangaCount: document.getElementById('mangaCount'),
    chapterCount: document.getElementById('chapterCount'),
    totalSize: document.getElementById('totalSize'),
    storageBar: document.getElementById('storageBar'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    storageInfo: document.getElementById('storageInfo')
};

// State
let currentUser = getCurrentUser();
let downloads = [];
let currentFilter = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        window.location.href = 'signin.html';
        return;
    }

    loadDownloads();
    setupEventListeners();

    onAuthChange((user) => {
        currentUser = user;
        if (!user) {
            window.location.href = 'signin.html';
        }
    });
});

// Setup event listeners
function setupEventListeners() {
    elements.filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            elements.filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            filterDownloads();
        });
    });
}

// Load downloads
async function loadDownloads() {
    try {
        const { data, error } = await supabase
            .from('user_downloads')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('is_available', true)
            .order('downloaded_at', { ascending: false });

        if (error) throw error;

        downloads = data || [];
        
        // Group by manga
        const grouped = groupByManga(downloads);
        displayDownloads(grouped);
        updateStorageInfo();

    } catch (error) {
        console.error('Error loading downloads:', error);
        notifications.error('Failed to load downloads');
    }
}

// Group downloads by manga
function groupByManga(downloads) {
    const grouped = {};

    downloads.forEach(download => {
        if (!grouped[download.manga_id]) {
            grouped[download.manga_id] = {
                manga_id: download.manga_id,
                manga_title: download.manga_title,
                manga_cover: download.manga_cover,
                downloaded_at: download.downloaded_at,
                chapters: [],
                total_size: 0,
                last_read: null,
                progress: 0
            };
        }

        grouped[download.manga_id].chapters.push(download);
        grouped[download.manga_id].total_size += download.file_size || 0;
        
        // Track last read
        if (download.last_read && (!grouped[download.manga_id].last_read || 
            new Date(download.last_read) > new Date(grouped[download.manga_id].last_read))) {
            grouped[download.manga_id].last_read = download.last_read;
        }

        // Calculate progress
        if (download.read_percentage > grouped[download.manga_id].progress) {
            grouped[download.manga_id].progress = download.read_percentage;
        }
    });

    // Sort chapters by chapter number
    Object.values(grouped).forEach(manga => {
        manga.chapters.sort((a, b) => a.chapter_number - b.chapter_number);
    });

    return Object.values(grouped);
}

// Display downloads
function displayDownloads(mangaList) {
    if (!elements.downloadsGrid) return;

    if (mangaList.length === 0) {
        elements.downloadsGrid.innerHTML = `
            <div class="empty-downloads">
                <i class="fas fa-download"></i>
                <h3>No Downloads Yet</h3>
                <p>Download manga to read them offline anytime</p>
                <a href="manga.html" class="btn-primary">Browse Manga</a>
                <a href="premium.html" class="btn-secondary">Get Premium for Unlimited</a>
            </div>
        `;
        return;
    }

    elements.downloadsGrid.innerHTML = mangaList.map(manga => `
        <div class="download-card" data-manga-id="${manga.manga_id}">
            <div class="download-header">
                <div class="download-cover">
                    <img src="${manga.manga_cover || '../images/no-cover.jpg'}" alt="${Utils.escapeHtml(manga.manga_title)}">
                </div>
                <div class="download-info">
                    <h3>${Utils.escapeHtml(manga.manga_title)}</h3>
                    <div class="download-meta">
                        <span><i class="fas fa-layer-group"></i> ${manga.chapters.length} chapters</span>
                        <span><i class="fas fa-database"></i> ${formatBytes(manga.total_size)}</span>
                    </div>
                    <div class="download-meta">
                        <span><i class="fas fa-clock"></i> Downloaded ${Utils.timeAgo(manga.downloaded_at)}</span>
                    </div>
                    <span class="progress-badge ${manga.progress === 100 ? 'completed' : 'in-progress'}">
                        ${manga.progress}% read
                    </span>
                </div>
            </div>

            <div class="chapters-list">
                ${manga.chapters.map(ch => `
                    <div class="chapter-item" onclick="readChapter(${ch.chapter_id})">
                        <div class="chapter-info">
                            <h4>Chapter ${ch.chapter_number}</h4>
                            <p>${ch.chapter_title || ''} • ${formatBytes(ch.file_size)}</p>
                        </div>
                        <div class="chapter-actions">
                            <button class="chapter-btn read" onclick="readChapter(${ch.chapter_id}, event)">
                                <i class="fas fa-book-open"></i>
                            </button>
                            <button class="chapter-btn delete" onclick="deleteChapter(${ch.id}, event)">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="download-footer">
                <div class="download-stats">
                    <span><i class="fas fa-eye"></i> Last read: ${manga.last_read ? Utils.timeAgo(manga.last_read) : 'Never'}</span>
                </div>
                <div class="download-actions">
                    <button class="download-action-btn read-all" onclick="readAllChapters(${manga.manga_id})">
                        <i class="fas fa-play"></i> Read All
                    </button>
                    <button class="download-action-btn delete-all" onclick="deleteManga(${manga.manga_id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Update storage information
async function updateStorageInfo() {
    try {
        const { data, error } = await supabase
            .from('download_limits')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (error) throw error;

        const mangaCount = downloads.reduce((acc, d) => {
            acc.add(d.manga_id);
            return acc;
        }, new Set()).size;

        const chapterCount = downloads.length;
        const totalBytes = downloads.reduce((sum, d) => sum + (d.file_size || 0), 0);
        const maxStorage = 500 * 1024 * 1024; // 500MB default
        const percentage = (totalBytes / maxStorage) * 100;

        if (elements.mangaCount) {
            elements.mangaCount.textContent = mangaCount;
        }
        if (elements.chapterCount) {
            elements.chapterCount.textContent = chapterCount;
        }
        if (elements.totalSize) {
            elements.totalSize.textContent = formatBytes(totalBytes);
        }
        if (elements.storageBar) {
            elements.storageBar.style.width = `${Math.min(percentage, 100)}%`;
        }

        // Show premium upgrade if near limit
        if (percentage > 80 && !data?.is_premium) {
            showStorageWarning();
        }

    } catch (error) {
        console.error('Error updating storage info:', error);
    }
}

// Show storage warning
function showStorageWarning() {
    const warning = document.createElement('div');
    warning.className = 'storage-warning';
    warning.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>Storage almost full! </span>
        <a href="premium.html">Upgrade to Premium for more space</a>
    `;
    elements.storageInfo?.appendChild(warning);
}

// Filter downloads
function filterDownloads() {
    const cards = document.querySelectorAll('.download-card');
    
    cards.forEach(card => {
        const progress = card.querySelector('.progress-badge').textContent;
        
        switch(currentFilter) {
            case 'reading':
                card.style.display = progress.includes('in-progress') ? 'block' : 'none';
                break;
            case 'completed':
                card.style.display = progress.includes('completed') ? 'block' : 'none';
                break;
            case 'pending':
                card.style.display = progress.includes('0%') ? 'block' : 'none';
                break;
            default:
                card.style.display = 'block';
        }
    });
}

// Read chapter
window.readChapter = function(chapterId, event) {
    if (event) event.stopPropagation();
    
    // Update last read
    supabase
        .from('user_downloads')
        .update({ last_read: new Date().toISOString() })
        .eq('id', chapterId)
        .then();

    // In offline page, this will load from IndexedDB
    // For now, redirect to online reader
    window.location.href = `offline-reader.html?chapter=${chapterId}`;
};

// Read all chapters
window.readAllChapters = function(mangaId) {
    window.location.href = `offline-reader.html?manga=${mangaId}`;
};

// Delete single chapter
window.deleteChapter = async function(downloadId, event) {
    event.stopPropagation();

    if (!confirm('Delete this chapter?')) return;

    try {
        const { error } = await supabase
            .from('user_downloads')
            .delete()
            .eq('id', downloadId);

        if (error) throw error;

        // Update download limits
        await supabase
            .from('download_limits')
            .update({
                chapter_count: supabase.raw('chapter_count - 1')
            })
            .eq('user_id', currentUser.id);

        notifications.success('Chapter deleted');
        loadDownloads();

    } catch (error) {
        console.error('Error deleting chapter:', error);
        notifications.error('Failed to delete chapter');
    }
};

// Delete entire manga
window.deleteManga = async function(mangaId) {
    if (!confirm('Delete all downloaded chapters for this manga?')) return;

    try {
        const { error } = await supabase
            .from('user_downloads')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('manga_id', mangaId);

        if (error) throw error;

        notifications.success('Manga deleted from downloads');
        loadDownloads();

    } catch (error) {
        console.error('Error deleting manga:', error);
        notifications.error('Failed to delete manga');
    }
};

// Format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Theme toggle
document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('night-mode');
    const icon = document.querySelector('#themeToggle i');
    icon.className = document.body.classList.contains('night-mode') ? 'fas fa-sun' : 'fas fa-moon';
});