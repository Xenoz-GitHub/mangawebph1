// Forum page
import { supabase, getCurrentUser, onAuthChange } from '../supabase.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    discussionsList: document.getElementById('discussionsList'),
    forumSearch: document.getElementById('forumSearch'),
    searchBtn: document.querySelector('.forum-search button'),
    newPostBtn: document.querySelector('.new-post-btn'),
    forumTabs: document.querySelectorAll('.forum-tab'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    newPostModal: document.getElementById('newPostModal'),
    postTitle: document.getElementById('postTitle'),
    postCategory: document.getElementById('postCategory'),
    postContent: document.getElementById('postContent'),
    postTags: document.getElementById('postTags'),
    createPostBtn: document.querySelector('#newPostModal .btn-primary'),
    cancelPostBtn: document.querySelector('#newPostModal .btn-secondary')
};

// State
let currentUser = getCurrentUser();
let currentPage = 1;
let currentTab = 'latest';
let currentFilter = 'all';
const ITEMS_PER_PAGE = 10;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDiscussions();
    setupEventListeners();

    // Listen for auth changes
    onAuthChange((user) => {
        currentUser = user;
    });
});

// Setup event listeners
function setupEventListeners() {
    // Search
    if (elements.searchBtn) {
        elements.searchBtn.addEventListener('click', searchForum);
    }
    if (elements.forumSearch) {
        elements.forumSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchForum();
        });
    }

    // New post button
    if (elements.newPostBtn) {
        elements.newPostBtn.addEventListener('click', openNewPostModal);
    }

    // Modal buttons
    if (elements.cancelPostBtn) {
        elements.cancelPostBtn.addEventListener('click', closeNewPostModal);
    }
    if (elements.createPostBtn) {
        elements.createPostBtn.addEventListener('click', createPost);
    }

    // Tabs
    elements.forumTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            elements.forumTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentTab = this.dataset.tab;
            loadDiscussions(true);
        });
    });

    // Filters
    elements.filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            elements.filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            loadDiscussions(true);
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === elements.newPostModal) {
            closeNewPostModal();
        }
    });
}

// Load discussions
async function loadDiscussions(reset = true) {
    if (!elements.discussionsList) return;

    if (reset) {
        currentPage = 1;
        showLoading();
    }

    try {
        let query = supabase
            .from('forum_posts')
            .select(`
                *,
                profiles:user_id (id, username, avatar_url, avatar_frame),
                comments:forum_comments(count)
            `, { count: 'exact' });

        // Apply tab filter
        if (currentTab === 'popular') {
            query = query.order('views', { ascending: false });
        } else if (currentTab === 'unanswered') {
            query = query.is('comments.count', 0);
        } else {
            query = query.order('created_at', { ascending: false });
        }

        // Apply time filter
        if (currentFilter !== 'all') {
            const date = new Date();
            if (currentFilter === 'today') date.setHours(0,0,0,0);
            if (currentFilter === 'week') date.setDate(date.getDate() - 7);
            if (currentFilter === 'month') date.setMonth(date.getMonth() - 1);
            query = query.gte('created_at', date.toISOString());
        }

        // Pagination
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        query = query.range(from, to);

        const { data: posts, error } = await query;

        if (error) throw error;

        displayDiscussions(posts, reset);

    } catch (error) {
        console.error('Error loading discussions:', error);
        notifications.error('Failed to load discussions');
    }
}

// Display discussions
function displayDiscussions(posts, reset) {
    if (!elements.discussionsList) return;

    if (!posts || posts.length === 0) {
        if (reset) {
            elements.discussionsList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-comments"></i>
                    <p>No discussions yet</p>
                    <button class="btn-primary" onclick="openNewPostModal()">Start a Discussion</button>
                </div>
            `;
        }
        return;
    }

    const postsHtml = posts.map(post => {
        const isPinned = post.is_pinned;
        const isPopular = post.views > 1000;
        const commentCount = post.comments?.[0]?.count || 0;

        return `
            <div class="discussion-item ${isPinned ? 'pinned' : ''} ${isPopular ? 'popular' : ''}" onclick="window.location.href='discussion.html?id=${post.id}'">
                <div class="discussion-avatar avatar-frame ${post.profiles?.avatar_frame || ''}">
                    <img src="${post.profiles?.avatar_url || 'images/default-avatar.png'}" alt="${Utils.escapeHtml(post.profiles?.username || 'User')}">
                </div>
                <div class="discussion-content">
                    <div class="discussion-header">
                        <h3 class="discussion-title">${Utils.escapeHtml(post.title)}</h3>
                        ${isPinned ? '<span class="discussion-badge badge-pinned">📌 Pinned</span>' : ''}
                        ${isPopular ? '<span class="discussion-badge badge-popular">🔥 Popular</span>' : ''}
                    </div>
                    <div class="discussion-meta">
                        <span><i class="fas fa-user"></i> ${Utils.escapeHtml(post.profiles?.username || 'Anonymous')}</span>
                        <span><i class="fas fa-clock"></i> ${Utils.timeAgo(post.created_at)}</span>
                        <span><i class="fas fa-folder"></i> ${post.category || 'General'}</span>
                    </div>
                    <p class="discussion-excerpt">${Utils.truncateText(Utils.escapeHtml(post.content), 150)}</p>
                    <div class="discussion-tags">
                        ${post.tags?.map(tag => `<span class="discussion-tag">${Utils.escapeHtml(tag)}</span>`).join('') || ''}
                    </div>
                </div>
                <div class="discussion-stats">
                    <div>
                        <div class="stat-value">${commentCount}</div>
                        <div>replies</div>
                    </div>
                    <div>
                        <div class="stat-value">${Utils.formatNumber(post.views || 0)}</div>
                        <div>views</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (reset) {
        elements.discussionsList.innerHTML = postsHtml;
    } else {
        elements.discussionsList.insertAdjacentHTML('beforeend', postsHtml);
    }
}

// Search forum
async function searchForum() {
    const query = elements.forumSearch?.value.trim();
    if (!query) return;

    try {
        const { data: posts, error } = await supabase
            .from('forum_posts')
            .select(`
                *,
                profiles:user_id (id, username, avatar_url, avatar_frame),
                comments:forum_comments(count)
            `)
            .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        displayDiscussions(posts, true);
    } catch (error) {
        console.error('Error searching forum:', error);
        notifications.error('Search failed');
    }
}

// Open new post modal
function openNewPostModal() {
    if (!currentUser) {
        notifications.warning('Please sign in to create a discussion');
        window.location.href = 'signin.html';
        return;
    }

    if (elements.newPostModal) {
        elements.newPostModal.classList.add('active');
    }
}

// Close new post modal
function closeNewPostModal() {
    if (elements.newPostModal) {
        elements.newPostModal.classList.remove('active');
        // Clear form
        if (elements.postTitle) elements.postTitle.value = '';
        if (elements.postCategory) elements.postCategory.value = 'general';
        if (elements.postContent) elements.postContent.value = '';
        if (elements.postTags) elements.postTags.value = '';
    }
}

// Create new post
async function createPost() {
    const title = elements.postTitle?.value.trim();
    const category = elements.postCategory?.value;
    const content = elements.postContent?.value.trim();
    const tags = elements.postTags?.value.split(',').map(t => t.trim()).filter(t => t);

    if (!title || !content) {
        notifications.error('Please fill in all required fields');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('forum_posts')
            .insert([{
                user_id: currentUser.id,
                title,
                content,
                category,
                tags,
                created_at: new Date().toISOString(),
                views: 0
            }])
            .select()
            .single();

        if (error) throw error;

        notifications.success('Discussion created successfully!');
        closeNewPostModal();
        loadDiscussions(true);

    } catch (error) {
        console.error('Error creating post:', error);
        notifications.error('Failed to create discussion');
    }
}

// Show loading
function showLoading() {
    if (!elements.discussionsList) return;

    elements.discussionsList.innerHTML = `
        <div class="loading-skeleton">
            ${Array(5).fill('<div class="skeleton-discussion"></div>').join('')}
        </div>
    `;
}