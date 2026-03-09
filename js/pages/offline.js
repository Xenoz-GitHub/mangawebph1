// Offline page
import { supabase, getCurrentUser } from '../supabase.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    downloadsList: document.getElementById('offlineDownloads'),
    retryBtn: document.getElementById('retryBtn'),
    cachedList: document.getElementById('cachedList')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadOfflineDownloads();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    if (elements.retryBtn) {
        elements.retryBtn.addEventListener('click', retryConnection);
    }
}

// Load offline downloads
async function loadOfflineDownloads() {
    if (!elements.downloadsList) return;

    try {
        const user = getCurrentUser();
        if (!user) {
            showLoginPrompt();
            return;
        }

        const { data: downloads, error } = await supabase
            .from('user_downloads')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_available', true)
            .order('downloaded_at', { ascending: false });

        if (error) throw error;

        if (!downloads || downloads.length === 0) {
            elements.downloadsList.innerHTML = `
                <div class="no-downloads">
                    <i class="fas fa-download"></i>
                    <p>No downloads available</p>
                    <p style="font-size: 0.8rem;">Connect to internet to download manga</p>
                </div>
            `;
            return;
        }

        // Group by manga
        const grouped = {};
        downloads.forEach(d => {
            if (!grouped[d.manga_id]) {
                grouped[d.manga_id] = {
                    manga_id: d.manga_id,
                    manga_title: d.manga_title,
                    manga_cover: d.manga_cover,
                    chapters: [],
                    last_read: d.last_read,
                    progress: d.read_percentage || 0
                };
            }
            grouped[d.manga_id].chapters.push(d);
        });

        elements.downloadsList.innerHTML = Object.values(grouped).map(manga => `
            <div class="download-item" onclick="openOfflineManga(${manga.manga_id})">
                <div class="download-cover">
                    <img src="${manga.manga_cover || 'images/no-cover.jpg'}" alt="${Utils.escapeHtml(manga.manga_title)}">
                </div>
                <div class="download-info">
                    <h4>${Utils.escapeHtml(manga.manga_title)}</h4>
                    <div class="download-progress">${manga.chapters.length} chapters</div>
                    <div class="download-size">Last read: ${manga.last_read ? Utils.timeAgo(manga.last_read) : 'Never'}</div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading offline downloads:', error);
        elements.downloadsList.innerHTML = `
            <div class="no-downloads">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load downloads</p>
            </div>
        `;
    }
}

// Show login prompt
function showLoginPrompt() {
    if (!elements.downloadsList) return;

    elements.downloadsList.innerHTML = `
        <div class="no-downloads">
            <i class="fas fa-user-lock"></i>
            <p>Sign in to access your downloads</p>
            <a href="pages/signin.html" class="btn-primary" style="display: inline-block; margin-top: 10px;">Sign In</a>
        </div>
    `;
}

// Open offline manga
window.openOfflineManga = function(mangaId) {
    window.location.href = `pages/offline-reader.html?manga=${mangaId}`;
};

// Retry connection
async function retryConnection() {
    const btn = document.getElementById('retryBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';

    setTimeout(() => {
        if (navigator.onLine) {
            window.location.reload();
        } else {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Retry Connection';
            alert('Still offline. Please check your connection.');
        }
    }, 2000);
}

// Listen for online event
window.addEventListener('online', () => {
    window.location.reload();
});