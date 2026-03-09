// Manga details page
import { supabase, getCurrentUser } from '../supabase.js';
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    mangaDetails: document.getElementById('mangaDetails'),
    ratingStars: document.getElementById('ratingStars'),
    favoriteBtn: document.getElementById('favoriteBtn'),
    chaptersList: document.getElementById('chaptersList'),
    relatedGrid: document.getElementById('relatedGrid'),
    commentsList: document.getElementById('commentsList'),
    commentForm: document.getElementById('commentForm'),
    commentInput: document.getElementById('commentInput'),
    postCommentBtn: document.querySelector('#commentForm button')
};

// State
let currentManga = null;
let userRating = 0;
let isFavorite = false;
let currentUser = getCurrentUser();

// Add to state at the top
let isDownloaded = false;
let downloadProgress = 0;
let downloadQueue = [];

// Check download status on load
async function checkDownloadStatus() {
    if (!currentUser) return;

    try {
        const { data, error } = await supabase
            .from('user_downloads')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('manga_id', mangaId)
            .limit(1);

        if (error) throw error;

        isDownloaded = data && data.length > 0;
        updateDownloadButton();
    } catch (error) {
        console.error('Error checking download status:', error);
    }
}

// Update download button
function updateDownloadButton() {
    const btn = document.getElementById('downloadBtn');
    if (!btn) return;

    if (isDownloaded) {
        btn.classList.add('downloaded');
        btn.innerHTML = '<i class="fas fa-check-circle"></i><span>Downloaded</span>';
        btn.onclick = null;
        btn.title = 'Already downloaded';
    } else {
        btn.classList.remove('downloaded');
        btn.innerHTML = '<i class="fas fa-download"></i><span>Download</span>';
        btn.onclick = toggleDownload;
        btn.title = 'Download Manga (3 max)';
    }
}

// Toggle download
async function toggleDownload() {
    if (!currentUser) {
        notifications.warning('Please sign in to download manga');
        window.location.href = 'signin.html';
        return;
    }

    if (isDownloaded) return;

    // Check download limit
    const { data: limitCheck, error: limitError } = await supabase
        .rpc('check_download_limit', {
            p_user_id: currentUser.id,
            p_manga_id: mangaId
        });

    if (limitError) {
        console.error('Error checking limit:', limitError);
        return;
    }

    if (!limitCheck.allowed) {
        showLimitModal(limitCheck);
        return;
    }

    // Start download
    startDownload();
}

// Show limit modal
function showLimitModal(limitInfo) {
    const modal = document.getElementById('limitModal');
    const message = document.getElementById('limitMessage');
    const current = document.getElementById('currentDownloads');

    if (message) message.textContent = limitInfo.message;
    if (current) current.textContent = limitInfo.current;

    if (modal) modal.classList.add('active');
}

// Close limit modal
window.closeLimitModal = function() {
    document.getElementById('limitModal')?.classList.remove('active');
};

// Start download
async function startDownload() {
    const modal = document.getElementById('downloadModal');
    const progressFill = document.getElementById('downloadProgress');
    const status = document.getElementById('downloadStatus');
    const downloadedSize = document.getElementById('downloadedSize');
    const totalSizeEl = document.getElementById('totalSize');
    const titleEl = document.getElementById('downloadTitle');
    const coverEl = document.getElementById('downloadCover');

    // Set modal info
    if (titleEl) titleEl.textContent = currentManga.title;
    if (coverEl) coverEl.src = currentManga.cover_url || 'images/no-cover.jpg';

    modal.classList.add('active');

    try {
        // Get all chapters
        const { data: chapters, error } = await supabase
            .from('chapters')
            .select('*')
            .eq('manga_id', mangaId)
            .order('chapter_number', { ascending: true });

        if (error) throw error;

        if (!chapters || chapters.length === 0) {
            notifications.warning('No chapters to download');
            closeDownloadModal();
            return;
        }

        // Update chapter count
        document.getElementById('downloadChapters').textContent = 
            `Downloading ${chapters.length} chapters...`;

        // Calculate total size (estimate)
        let totalBytes = 0;
        chapters.forEach(ch => {
            // Estimate 500KB per page
            const pages = ch.pages?.length || 0;
            totalBytes += pages * 500 * 1024;
        });

        const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
        totalSizeEl.textContent = `${totalMB} MB`;

        // Download chapters
        let downloadedBytes = 0;
        let downloadedChapters = 0;

        for (const chapter of chapters) {
            status.textContent = `Downloading Chapter ${chapter.chapter_number}...`;

            // Simulate download progress (in production, actual fetch)
            const chapterSize = (chapter.pages?.length || 0) * 500 * 1024;
            
            // Save to database
            const { error: insertError } = await supabase
                .from('user_downloads')
                .insert([{
                    user_id: currentUser.id,
                    manga_id: mangaId,
                    manga_title: currentManga.title,
                    manga_cover: currentManga.cover_url,
                    chapter_id: chapter.id,
                    chapter_number: chapter.chapter_number,
                    chapter_title: chapter.title,
                    pages: chapter.pages,
                    page_count: chapter.pages?.length || 0,
                    file_size: chapterSize,
                    downloaded_at: new Date().toISOString()
                }]);

            if (insertError) throw insertError;

            downloadedChapters++;
            downloadedBytes += chapterSize;

            // Update progress
            const progress = (downloadedChapters / chapters.length) * 100;
            progressFill.style.width = `${progress}%`;
            
            const downloadedMB = (downloadedBytes / (1024 * 1024)).toFixed(2);
            downloadedSize.textContent = `${downloadedMB} MB`;

            // Small delay for UX
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        status.textContent = 'Download Complete!';
        progressFill.style.width = '100%';
        downloadedSize.textContent = totalMB;

        // Update download count
        await supabase
            .from('download_limits')
            .upsert([{
                user_id: currentUser.id,
                manga_count: supabase.raw('manga_count + 1'),
                chapter_count: supabase.raw(`chapter_count + ${chapters.length}`),
                total_size: supabase.raw(`total_size + ${totalBytes}`)
            }]);

        isDownloaded = true;
        updateDownloadButton();

        setTimeout(() => {
            closeDownloadModal();
            notifications.success(`Downloaded ${chapters.length} chapters successfully!`);
        }, 1500);

    } catch (error) {
        console.error('Download error:', error);
        status.textContent = 'Download failed';
        notifications.error('Failed to download manga');
    }
}

// Close download modal
window.closeDownloadModal = function() {
    document.getElementById('downloadModal')?.classList.remove('active');
};

// Delete download
window.deleteDownload = async function() {
    if (!confirm('Delete downloaded manga? You can re-download later.')) return;

    try {
        const { error } = await supabase
            .from('user_downloads')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('manga_id', mangaId);

        if (error) throw error;

        isDownloaded = false;
        updateDownloadButton();
        notifications.success('Download removed');

    } catch (error) {
        console.error('Error deleting download:', error);
        notifications.error('Failed to delete download');
    }
};

// Add to load function
// In loadMangaDetails(), add:
await checkDownloadStatus();

// Get manga ID from URL
const urlParams = new URLSearchParams(window.location.search);
const mangaId = urlParams.get('id');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!mangaId) {
        window.location.href = 'manga.html';
        return;
    }
    
    loadMangaDetails();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Listen for auth changes
    window.addEventListener('auth-change', (e) => {
        currentUser = e.detail.user;
        if (currentUser && currentManga) {
            checkFavorite();
            checkUserRating();
        }
    });

    // Comment form
    if (elements.commentForm) {
        elements.commentForm.addEventListener('submit', handleCommentSubmit);
    }
}

// Load manga details
async function loadMangaDetails() {
    try {
        const { data: manga, error } = await supabase
            .from('manga')
            .select('*')
            .eq('id', mangaId)
            .single();

        if (error) throw error;
        
        currentManga = manga;
        displayMangaDetails(manga);

        // Update view count
        await supabase
            .from('manga')
            .update({ views: (manga.views || 0) + 1 })
            .eq('id', mangaId);

        // Load related content
        await Promise.all([
            loadChapters(),
            loadComments(),
            loadRelatedManga(manga.genres)
        ]);

        // Check user interactions if logged in
        if (currentUser) {
            await Promise.all([
                checkFavorite(),
                checkUserRating()
            ]);
        }

    } catch (error) {
        console.error('Error loading manga:', error);
        showError();
    }
}

// Display manga details
function displayMangaDetails(manga) {
    if (!elements.mangaDetails) return;

    elements.mangaDetails.innerHTML = `
        <div class="manga-header">
            <div class="manga-cover">
                <img src="${manga.cover_url || 'images/no-cover.jpg'}" alt="${Utils.escapeHtml(manga.title)}">
                <button class="favorite-btn ${isFavorite ? 'active' : ''}" id="favoriteBtn" onclick="window.toggleFavorite()">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
            <div class="manga-info">
                <h1>${Utils.escapeHtml(manga.title)}</h1>
                
                <div class="manga-stats">
                    <div class="stat">
                        <i class="fas fa-eye"></i>
                        <span>${Utils.formatNumber(manga.views || 0)} views</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-book-open"></i>
                        <span>${manga.chapters || 0} chapters</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-star"></i>
                        <span>${manga.rating?.toFixed(1) || 'N/A'} / 5</span>
                    </div>
                </div>
                
                <div class="rating-section">
                    <div class="rating-stars" id="ratingStars">
                        ${[1,2,3,4,5].map(i => `
                            <i class="fas fa-star ${userRating >= i ? 'active' : ''}" data-rating="${i}" onclick="window.rateManga(${i})"></i>
                        `).join('')}
                    </div>
                    <span class="rating-value">${manga.rating?.toFixed(1) || '0'} (${manga.rating_count || 0} ratings)</span>
                </div>
                
                <div class="description">
                    <p>${manga.description || 'No description available.'}</p>
                </div>
                
                <div class="meta-info">
                    <div class="meta-item">
                        <span class="meta-label">Author</span>
                        <span class="meta-value">${manga.author || 'Unknown'}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Artist</span>
                        <span class="meta-value">${manga.artist || 'Unknown'}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Status</span>
                        <span class="meta-value">${manga.status || 'Ongoing'}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Release Year</span>
                        <span class="meta-value">${manga.release_year || 'N/A'}</span>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="action-btn primary" onclick="window.startReading()">
                        <i class="fas fa-play"></i> Start Reading
                    </button>
                    <button class="action-btn secondary" onclick="window.addToCollection()">
                        <i class="fas fa-folder-plus"></i> Add to Collection
                    </button>
                </div>
            </div>
        </div>
        
        <div class="chapters-section">
            <div class="chapters-header">
                <h2>Chapters</h2>
                <div class="chapter-filters">
                    <button class="chapter-filter-btn active" onclick="window.filterChapters('all')">All</button>
                    <button class="chapter-filter-btn" onclick="window.filterChapters('new')">Latest</button>
                    <button class="chapter-filter-btn" onclick="window.filterChapters('unread')">Unread</button>
                </div>
            </div>
            <div class="chapters-list" id="chaptersList">
                <div class="loading">Loading chapters...</div>
            </div>
        </div>
        
        <div class="related-section">
            <h2>You Might Also Like</h2>
            <div class="related-grid" id="relatedGrid"></div>
        </div>
        
        <div class="comments-section">
            <h2>Comments</h2>
            
            ${currentUser ? `
                <form class="comment-form" id="commentForm">
                    <input type="text" id="commentInput" placeholder="Write a comment..." required>
                    <button type="submit"><i class="fas fa-paper-plane"></i></button>
                </form>
            ` : `
                <p style="text-align: center; margin: 1rem 0;">
                    <a href="signin.html">Sign in</a> to leave a comment
                </p>
            `}
            
            <div id="commentsList"></div>
        </div>
    `;

    // Re-attach favorite button listener
    document.getElementById('favoriteBtn')?.addEventListener('click', toggleFavorite);
}

// Load chapters
async function loadChapters() {
    if (!elements.chaptersList) return;

    try {
        const { data: chapters, error } = await supabase
            .from('chapters')
            .select('*')
            .eq('manga_id', mangaId)
            .order('chapter_number', { ascending: false });

        if (error) throw error;

        if (!chapters || chapters.length === 0) {
            elements.chaptersList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-book-open"></i>
                    <p>No chapters available yet</p>
                </div>
            `;
            return;
        }

        elements.chaptersList.innerHTML = chapters.map(ch => `
            <div class="chapter-item" onclick="window.readChapter(${ch.id})">
                <div class="chapter-info">
                    <h4>Chapter ${ch.chapter_number}${ch.title ? ': ' + Utils.escapeHtml(ch.title) : ''}</h4>
                    <div class="chapter-meta">
                        <span><i class="fas fa-calendar"></i> ${Utils.formatDate(ch.created_at, 'short')}</span>
                        <span><i class="fas fa-eye"></i> ${Utils.formatNumber(ch.views || 0)} views</span>
                    </div>
                </div>
                <div class="chapter-read-btn">
                    Read <i class="fas fa-arrow-right"></i>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading chapters:', error);
        elements.chaptersList.innerHTML = '<p class="error">Error loading chapters</p>';
    }
}

// Load related manga
async function loadRelatedManga(genres) {
    if (!elements.relatedGrid) return;

    try {
        if (!genres || genres.length === 0) {
            elements.relatedGrid.innerHTML = '<p>No related manga found</p>';
            return;
        }

        const { data: manga, error } = await supabase
            .from('manga')
            .select('*')
            .neq('id', mangaId)
            .overlaps('genres', genres)
            .limit(6);

        if (error) throw error;

        if (!manga || manga.length === 0) {
            elements.relatedGrid.innerHTML = '<p>No related manga found</p>';
            return;
        }

        elements.relatedGrid.innerHTML = manga.map(m => `
            <div class="related-card" onclick="window.location.href='manga-details.html?id=${m.id}'">
                <img src="${m.cover_url || 'images/no-cover.jpg'}" alt="${Utils.escapeHtml(m.title)}">
                <h4>${Utils.escapeHtml(m.title)}</h4>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading related manga:', error);
    }
}

// Load comments
async function loadComments() {
    if (!elements.commentsList) return;

    try {
        const { data: comments, error } = await supabase
            .from('comments')
            .select(`
                *,
                profiles:user_id (id, username, avatar_url, avatar_frame)
            `)
            .eq('manga_id', mangaId)
            .is('parent_id', null)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!comments || comments.length === 0) {
            elements.commentsList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-comments"></i>
                    <p>No comments yet. Be the first to comment!</p>
                </div>
            `;
            return;
        }

        elements.commentsList.innerHTML = comments.map(c => `
            <div class="comment">
                <div class="comment-avatar avatar-frame ${c.profiles?.avatar_frame || ''}">
                    <img src="${c.profiles?.avatar_url || 'images/default-avatar.png'}" alt="${Utils.escapeHtml(c.profiles?.username || 'User')}">
                </div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${Utils.escapeHtml(c.profiles?.username || 'Anonymous')}</span>
                        <span class="comment-date">${Utils.timeAgo(c.created_at)}</span>
                    </div>
                    <p class="comment-text">${Utils.escapeHtml(c.content)}</p>
                    <div class="comment-actions">
                        <button onclick="window.likeComment(${c.id})">
                            <i class="fas fa-heart"></i> ${c.likes || 0}
                        </button>
                        <button onclick="window.replyToComment(${c.id})">
                            <i class="fas fa-reply"></i> Reply
                        </button>
                    </div>
                    ${c.replies ? c.replies.map(r => `
                        <div class="comment reply">
                            <div class="comment-avatar avatar-frame ${r.profiles?.avatar_frame || ''}">
                                <img src="${r.profiles?.avatar_url || 'images/default-avatar.png'}" alt="${Utils.escapeHtml(r.profiles?.username || 'User')}">
                            </div>
                            <div class="comment-content">
                                <div class="comment-header">
                                    <span class="comment-author">${Utils.escapeHtml(r.profiles?.username || 'Anonymous')}</span>
                                    <span class="comment-date">${Utils.timeAgo(r.created_at)}</span>
                                </div>
                                <p class="comment-text">${Utils.escapeHtml(r.content)}</p>
                            </div>
                        </div>
                    `).join('') : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

// Check if manga is in favorites
async function checkFavorite() {
    if (!currentUser) return;

    try {
        const { data, error } = await supabase
            .from('favorites')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('manga_id', mangaId)
            .maybeSingle();

        if (error) throw error;

        isFavorite = !!data;
        const favBtn = document.getElementById('favoriteBtn');
        if (favBtn) {
            favBtn.classList.toggle('active', isFavorite);
        }
    } catch (error) {
        console.error('Error checking favorite:', error);
    }
}

// Check user rating
async function checkUserRating() {
    if (!currentUser) return;

    try {
        const { data, error } = await supabase
            .from('user_ratings')
            .select('rating')
            .eq('user_id', currentUser.id)
            .eq('manga_id', mangaId)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            userRating = data.rating;
            highlightStars(userRating);
        }
    } catch (error) {
        console.error('Error checking rating:', error);
    }
}

// Highlight stars
function highlightStars(rating) {
    const stars = document.querySelectorAll('.rating-stars i');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

// Toggle favorite
window.toggleFavorite = async function() {
    if (!currentUser) {
        notifications.warning('Please sign in to add to favorites');
        window.location.href = 'signin.html';
        return;
    }

    try {
        if (isFavorite) {
            await api.removeFavorite(currentUser.id, mangaId);
            isFavorite = false;
        } else {
            await api.addFavorite(currentUser.id, mangaId);
            isFavorite = true;
        }

        const favBtn = document.getElementById('favoriteBtn');
        if (favBtn) {
            favBtn.classList.toggle('active', isFavorite);
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
};

// Rate manga
window.rateManga = async function(rating) {
    if (!currentUser) {
        notifications.warning('Please sign in to rate');
        window.location.href = 'signin.html';
        return;
    }

    const result = await api.rateManga(currentUser.id, mangaId, rating);
    if (result.success) {
        userRating = rating;
        highlightStars(rating);
    }
};

// Start reading
window.startReading = function() {
    window.location.href = `reader.html?manga=${mangaId}`;
};

// Read chapter
window.readChapter = function(chapterId) {
    window.location.href = `reader.html?manga=${mangaId}&chapter=${chapterId}`;
};

// Add to collection
window.addToCollection = function() {
    if (!currentUser) {
        notifications.warning('Please sign in to create collections');
        window.location.href = 'signin.html';
        return;
    }
    window.location.href = `collections.html?add=${mangaId}`;
};

// Filter chapters
window.filterChapters = function(filter) {
    document.querySelectorAll('.chapter-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === filter);
    });
    // Implement filtering logic
};

// Handle comment submission
async function handleCommentSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
        notifications.warning('Please sign in to comment');
        window.location.href = 'signin.html';
        return;
    }

    const content = elements.commentInput?.value?.trim();
    if (!content) return;

    const result = await api.addComment(currentUser.id, mangaId, content);
    if (result.success) {
        elements.commentInput.value = '';
        await loadComments(); // Reload comments
    }
}

// Like comment
window.likeComment = async function(commentId) {
    if (!currentUser) {
        notifications.warning('Please sign in to like comments');
        return;
    }

    try {
        const { error } = await supabase.rpc('increment_comment_likes', {
            comment_id: commentId
        });

        if (error) throw error;
        await loadComments(); // Reload to show updated likes
    } catch (error) {
        console.error('Error liking comment:', error);
    }
};

// Reply to comment
window.replyToComment = function(commentId) {
    if (!currentUser) {
        notifications.warning('Please sign in to reply');
        window.location.href = 'signin.html';
        return;
    }

    const replyText = prompt('Enter your reply:');
    if (replyText) {
        api.addComment(currentUser.id, mangaId, replyText, null, commentId);
    }
};

// Show error
function showError() {
    if (!elements.mangaDetails) return;
    
    elements.mangaDetails.innerHTML = `
        <div class="error-container">
            <i class="fas fa-exclamation-circle"></i>
            <h2>Manga not found</h2>
            <p>The manga you're looking for doesn't exist or has been removed.</p>
            <a href="manga.html" class="btn-primary">Browse Manga</a>
        </div>
    `;
}