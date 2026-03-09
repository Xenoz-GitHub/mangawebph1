// Profile page
import { supabase, getCurrentUser, onAuthChange } from '../supabase.js';
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    profileCover: document.getElementById('profileCover'),
    profileAvatar: document.getElementById('profileAvatar'),
    profileName: document.getElementById('profileName'),
    profileUsername: document.getElementById('profileUsername'),
    profileBio: document.getElementById('profileBio'),
    profileBadge: document.getElementById('profileBadge'),
    editCoverBtn: document.getElementById('editCoverBtn'),
    editAvatarBtn: document.getElementById('editAvatarBtn'),
    editProfileBtn: document.getElementById('editProfileBtn'),
    followBtn: document.getElementById('followBtn'),
    messageBtn: document.getElementById('messageBtn'),
    statChapters: document.getElementById('statChapters'),
    statManga: document.getElementById('statManga'),
    statStreak: document.getElementById('statStreak'),
    statXP: document.getElementById('statXP'),
    statLevel: document.getElementById('statLevel'),
    statFollowers: document.getElementById('statFollowers'),
    avatarWrapper: document.getElementById('avatarWrapper'),
    activityFeed: document.getElementById('activityFeed'),
    libraryGrid: document.getElementById('libraryGrid'),
    collectionsGrid: document.getElementById('collectionsGrid'),
    badgesGrid: document.getElementById('badgesGrid'),
    achievementsGrid: document.getElementById('achievementsGrid'),
    followersList: document.getElementById('followersList'),
    followingList: document.getElementById('followingList'),
    frameModal: document.getElementById('frameModal'),
    framesGrid: document.getElementById('framesGrid'),
    editProfileModal: document.getElementById('editProfileModal'),
    editProfileForm: document.getElementById('editProfileForm'),
    editName: document.getElementById('editName'),
    editBio: document.getElementById('editBio'),
    editFacebook: document.getElementById('editFacebook')
};

// State
const urlParams = new URLSearchParams(window.location.search);
const profileId = urlParams.get('id') || getCurrentUser()?.id;

let profileData = null;
let isOwnProfile = false;
let currentUser = getCurrentUser();
let selectedFrame = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!profileId) {
        window.location.href = 'signin.html';
        return;
    }

    loadProfile();
    setupEventListeners();
    setupTabs();

    // Listen for auth changes
    onAuthChange((user) => {
        currentUser = user;
        isOwnProfile = user?.id === profileId;
        if (profileData) {
            updateActionButtons();
        }
    });
});

// Setup event listeners
function setupEventListeners() {
    // Edit profile
    if (elements.editProfileBtn) {
        elements.editProfileBtn.addEventListener('click', openEditModal);
    }

    // Follow button
    if (elements.followBtn) {
        elements.followBtn.addEventListener('click', toggleFollow);
    }

    // Message button
    if (elements.messageBtn) {
        elements.messageBtn.addEventListener('click', sendMessage);
    }

    // Edit avatar
    if (elements.editAvatarBtn) {
        elements.editAvatarBtn.addEventListener('click', openFrameModal);
    }

    // Edit cover
    if (elements.editCoverBtn) {
        elements.editCoverBtn.addEventListener('click', uploadCover);
    }

    // Close frame modal
    document.getElementById('closeFramesBtn')?.addEventListener('click', closeFrameModal);
    document.getElementById('saveFrameBtn')?.addEventListener('click', saveFrame);

    // Close edit modal
    document.getElementById('closeEditBtn')?.addEventListener('click', closeEditModal);
    if (elements.editProfileForm) {
        elements.editProfileForm.addEventListener('submit', saveProfile);
    }

    // Library filter
    document.getElementById('libraryFilter')?.addEventListener('change', filterLibrary);
}

// Setup tabs
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            this.classList.add('active');
            const tabId = `tab-${this.dataset.tab}`;
            document.getElementById(tabId)?.classList.add('active');
        });
    });

    document.querySelectorAll('.sub-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            if (this.dataset.subtab === 'followers') {
                if (elements.followersList) elements.followersList.style.display = 'grid';
                if (elements.followingList) elements.followingList.style.display = 'none';
            } else {
                if (elements.followersList) elements.followersList.style.display = 'none';
                if (elements.followingList) elements.followingList.style.display = 'grid';
            }
        });
    });
}

// Load profile
async function loadProfile() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .single();

        if (error) throw error;

        profileData = profile;
        isOwnProfile = currentUser?.id === profileId;

        displayProfile(profile);

        // Load all sections
        await Promise.all([
            loadActivities(),
            loadLibrary(),
            loadCollections(),
            loadBadges(),
            loadAchievements(),
            loadFollowers()
        ]);

        updateActionButtons();

    } catch (error) {
        console.error('Error loading profile:', error);
        showError();
    }
}

// Display profile
function displayProfile(profile) {
    if (elements.profileName) {
        elements.profileName.textContent = profile.full_name || profile.username;
    }

    if (elements.profileUsername) {
        elements.profileUsername.textContent = '@' + profile.username;
    }

    if (elements.profileBio) {
        elements.profileBio.textContent = profile.bio || 'No bio yet.';
    }

    if (elements.profileAvatar) {
        elements.profileAvatar.src = profile.avatar_url || 'images/default-avatar.png';
    }

    if (elements.profileCover) {
        elements.profileCover.src = profile.cover_url || 'images/default-cover.jpg';
    }

    // Apply avatar frame
    if (elements.avatarWrapper && profile.avatar_frame) {
        elements.avatarWrapper.className = `profile-avatar-wrapper avatar-frame ${profile.avatar_frame}`;
    }

    // Premium badge
    if (elements.profileBadge && profile.is_premium) {
        elements.profileBadge.style.display = 'inline-flex';
    }

    // Stats
    if (elements.statChapters) {
        elements.statChapters.textContent = profile.chapters_read || 0;
    }

    if (elements.statManga) {
        elements.statManga.textContent = profile.manga_finished || 0;
    }

    if (elements.statStreak) {
        elements.statStreak.textContent = profile.streak || 0;
    }

    if (elements.statXP) {
        elements.statXP.textContent = profile.xp || 0;
    }

    if (elements.statLevel) {
        elements.statLevel.textContent = profile.level || 1;
    }

    if (elements.statFollowers) {
        elements.statFollowers.textContent = profile.followers_count || 0;
    }
}

// Update action buttons based on ownership
function updateActionButtons() {
    if (isOwnProfile) {
        if (elements.editCoverBtn) elements.editCoverBtn.style.display = 'flex';
        if (elements.editAvatarBtn) elements.editAvatarBtn.style.display = 'flex';
        if (elements.editProfileBtn) elements.editProfileBtn.style.display = 'block';
        if (elements.followBtn) elements.followBtn.style.display = 'none';
        if (elements.messageBtn) elements.messageBtn.style.display = 'none';
    } else {
        if (elements.editCoverBtn) elements.editCoverBtn.style.display = 'none';
        if (elements.editAvatarBtn) elements.editAvatarBtn.style.display = 'none';
        if (elements.editProfileBtn) elements.editProfileBtn.style.display = 'none';
        if (elements.followBtn) elements.followBtn.style.display = 'inline-flex';
        if (elements.messageBtn) elements.messageBtn.style.display = 'inline-flex';

        if (currentUser) {
            checkFollowStatus();
        }
    }
}

// Load activities
async function loadActivities() {
    if (!elements.activityFeed) return;

    try {
        const { data: activities, error } = await supabase
            .from('user_activities')
            .select('*')
            .eq('user_id', profileId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        if (!activities || activities.length === 0) {
            elements.activityFeed.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-history"></i>
                    <p>No activity yet</p>
                </div>
            `;
            return;
        }

        elements.activityFeed.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas ${getActivityIcon(activity.activity_type)}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-text">${getActivityText(activity)}</div>
                    <div class="activity-time">${Utils.timeAgo(activity.created_at)}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading activities:', error);
    }
}

// Get activity icon
function getActivityIcon(type) {
    const icons = {
        'read': 'fa-book-open',
        'rating': 'fa-star',
        'comment': 'fa-comment',
        'achievement': 'fa-trophy',
        'follow': 'fa-user-plus',
        'favorite': 'fa-heart',
        'collection': 'fa-layer-group'
    };
    return icons[type] || 'fa-circle';
}

// Get activity text
function getActivityText(activity) {
    const data = activity.activity_data || {};
    switch(activity.activity_type) {
        case 'read':
            return `Read a chapter`;
        case 'rating':
            return `Rated a manga ${data.rating} stars`;
        case 'comment':
            return `Left a comment`;
        case 'achievement':
            return `Earned achievement: ${data.achievement || 'Unknown'}`;
        case 'follow':
            return `Started following someone`;
        case 'favorite':
            return `Added to favorites`;
        default:
            return 'New activity';
    }
}

// Load library
async function loadLibrary() {
    if (!elements.libraryGrid) return;

    try {
        const { data: history, error } = await supabase
            .from('reading_history')
            .select(`
                *,
                manga:manga_id (*)
            `)
            .eq('user_id', profileId)
            .order('last_read', { ascending: false });

        if (error) throw error;

        if (!history || history.length === 0) {
            elements.libraryGrid.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-book-open"></i>
                    <p>No reading history yet</p>
                </div>
            `;
            return;
        }

        elements.libraryGrid.innerHTML = history.map(item => `
            <div class="library-item" onclick="window.location.href='manga-details.html?id=${item.manga_id}'">
                <img src="${item.manga?.cover_url || 'images/no-cover.jpg'}" alt="${Utils.escapeHtml(item.manga?.title || '')}">
                <div class="library-info">
                    <h4>${Utils.escapeHtml(item.manga?.title || '')}</h4>
                    <p>Chapter ${item.chapter_number}</p>
                    <div class="library-progress">
                        <div class="library-progress-bar" style="width: ${item.read_percentage || 0}%;"></div>
                    </div>
                    <small>Last read: ${Utils.timeAgo(item.last_read)}</small>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading library:', error);
    }
}

// Load collections
async function loadCollections() {
    if (!elements.collectionsGrid) return;

    try {
        const { data: collections, error } = await supabase
            .from('user_collections')
            .select('*')
            .eq('user_id', profileId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!collections || collections.length === 0) {
            elements.collectionsGrid.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-folder"></i>
                    <p>No collections yet</p>
                </div>
            `;
            return;
        }

        elements.collectionsGrid.innerHTML = collections.map(collection => `
            <div class="collection-card" onclick="window.location.href='collection.html?id=${collection.id}'">
                <div class="collection-icon">
                    <i class="fas ${collection.icon || 'fa-folder'}"></i>
                </div>
                <h3 class="collection-name">${Utils.escapeHtml(collection.name)}</h3>
                <div class="collection-count">${collection.manga_count || 0} items</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading collections:', error);
    }
}

// Load badges and frames
async function loadBadges() {
    if (!elements.badgesGrid) return;

    try {
        const { data: badges, error } = await supabase
            .from('user_badges')
            .select('*, badge:badge_id(*)')
            .eq('user_id', profileId);

        if (error) throw error;

        if (!badges || badges.length === 0) {
            elements.badgesGrid.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-medal"></i>
                    <p>No badges earned yet</p>
                </div>
            `;
            return;
        }

        elements.badgesGrid.innerHTML = badges.map(b => `
            <div class="badge-card">
                <div class="badge-icon">
                    <i class="fas ${b.badge?.icon || 'fa-medal'}"></i>
                </div>
                <div class="badge-name">${Utils.escapeHtml(b.badge?.name || 'Unknown Badge')}</div>
                <div class="badge-date">${Utils.formatDate(b.earned_at, 'short')}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading badges:', error);
    }
}

// Load achievements
async function loadAchievements() {
    if (!elements.achievementsGrid) return;

    try {
        const { data: achievements, error } = await supabase
            .from('achievements')
            .select('*')
            .eq('user_id', profileId)
            .order('unlocked_at', { ascending: false });

        if (error) throw error;

        if (!achievements || achievements.length === 0) {
            elements.achievementsGrid.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-trophy"></i>
                    <p>No achievements yet</p>
                </div>
            `;
            return;
        }

        elements.achievementsGrid.innerHTML = achievements.map(a => `
            <div class="badge-card">
                <div class="badge-icon">
                    <i class="fas fa-trophy"></i>
                </div>
                <div class="badge-name">${Utils.escapeHtml(a.name)}</div>
                <div class="badge-date">${Utils.formatDate(a.unlocked_at, 'short')}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading achievements:', error);
    }
}

// Load followers
async function loadFollowers() {
    if (!elements.followersList || !elements.followingList) return;

    try {
        // Get followers
        const { data: followers, error: followersError } = await supabase
            .from('follows')
            .select(`
                follower:follower_id(id, username, avatar_url, avatar_frame)
            `)
            .eq('following_id', profileId);

        if (followersError) throw followersError;

        // Get following
        const { data: following, error: followingError } = await supabase
            .from('follows')
            .select(`
                following:following_id(id, username, avatar_url, avatar_frame)
            `)
            .eq('follower_id', profileId);

        if (followingError) throw followingError;

        // Display followers
        if (followers.length === 0) {
            elements.followersList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-users"></i>
                    <p>No followers yet</p>
                </div>
            `;
        } else {
            elements.followersList.innerHTML = followers.map(f => `
                <div class="user-card" onclick="window.location.href='profile.html?id=${f.follower.id}'">
                    <div class="avatar-frame ${f.follower.avatar_frame || ''}">
                        <img src="${f.follower.avatar_url || 'images/default-avatar.png'}" alt="${Utils.escapeHtml(f.follower.username)}">
                    </div>
                    <div class="user-info">
                        <h4>${Utils.escapeHtml(f.follower.username)}</h4>
                    </div>
                </div>
            `).join('');
        }

        // Display following
        if (following.length === 0) {
            elements.followingList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-user-friends"></i>
                    <p>Not following anyone yet</p>
                </div>
            `;
        } else {
            elements.followingList.innerHTML = following.map(f => `
                <div class="user-card" onclick="window.location.href='profile.html?id=${f.following.id}'">
                    <div class="avatar-frame ${f.following.avatar_frame || ''}">
                        <img src="${f.following.avatar_url || 'images/default-avatar.png'}" alt="${Utils.escapeHtml(f.following.username)}">
                    </div>
                    <div class="user-info">
                        <h4>${Utils.escapeHtml(f.following.username)}</h4>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading followers:', error);
    }
}

// Check follow status
async function checkFollowStatus() {
    if (!currentUser || !profileId) return;

    try {
        const { data, error } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', currentUser.id)
            .eq('following_id', profileId)
            .maybeSingle();

        if (error) throw error;

        if (elements.followBtn) {
            if (data) {
                elements.followBtn.innerHTML = '<i class="fas fa-user-check"></i> Following';
            } else {
                elements.followBtn.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
            }
        }
    } catch (error) {
        console.error('Error checking follow status:', error);
    }
}

// Toggle follow
async function toggleFollow() {
    if (!currentUser) {
        notifications.warning('Please sign in to follow users');
        window.location.href = 'signin.html';
        return;
    }

    if (currentUser.id === profileId) return;

    try {
        const isFollowing = elements.followBtn?.innerHTML.includes('Following');

        if (isFollowing) {
            await api.unfollowUser(currentUser.id, profileId);
            if (elements.followBtn) {
                elements.followBtn.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
            }
            if (elements.statFollowers) {
                elements.statFollowers.textContent = parseInt(elements.statFollowers.textContent) - 1;
            }
        } else {
            await api.followUser(currentUser.id, profileId);
            if (elements.followBtn) {
                elements.followBtn.innerHTML = '<i class="fas fa-user-check"></i> Following';
            }
            if (elements.statFollowers) {
                elements.statFollowers.textContent = parseInt(elements.statFollowers.textContent) + 1;
            }
        }
    } catch (error) {
        console.error('Error toggling follow:', error);
    }
}

// Send message
function sendMessage() {
    if (!currentUser) {
        notifications.warning('Please sign in to send messages');
        window.location.href = 'signin.html';
        return;
    }
    window.location.href = `messages.html?user=${profileId}`;
}

// Upload cover
async function uploadCover() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentUser.id}_cover_${Date.now()}.${fileExt}`;
            const filePath = `covers/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('profiles')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('profiles')
                .getPublicUrl(filePath);

            await supabase
                .from('profiles')
                .update({ cover_url: urlData.publicUrl })
                .eq('id', currentUser.id);

            if (elements.profileCover) {
                elements.profileCover.src = urlData.publicUrl;
            }

            notifications.success('Cover updated');
        } catch (error) {
            console.error('Error uploading cover:', error);
            notifications.error('Failed to upload cover');
        }
    };
    input.click();
}

// Open frame modal
async function openFrameModal() {
    if (!elements.frameModal || !elements.framesGrid) return;

    // Load available frames
    const frames = [
        { name: 'Rookie Frame', class: 'day1', requirement: '1 day streak' },
        { name: 'Novice Frame', class: 'day5', requirement: '5 day streak' },
        { name: 'Apprentice Frame', class: 'day10', requirement: '10 day streak' },
        { name: 'Warrior Frame', class: 'day15', requirement: '15 day streak' },
        { name: 'Elite Frame', class: 'day20', requirement: '20 day streak' },
        { name: 'Master Frame', class: 'day25', requirement: '25 day streak' },
        { name: 'Legend Frame', class: 'day30', requirement: '30 day streak' },
        { name: 'Mythic Frame', class: 'day40', requirement: '40 day streak' },
        { name: 'Divine Frame', class: 'day50', requirement: '50 day streak' },
        { name: 'Godly Frame', class: 'day60', requirement: '60 day streak' },
        { name: 'Celestial Frame', class: 'day70', requirement: '70 day streak' },
        { name: 'Cosmic Frame', class: 'day80', requirement: '80 day streak' },
        { name: 'Eternal Frame', class: 'day90', requirement: '90 day streak' },
        { name: 'God Frame', class: 'day100', requirement: '100 day streak' }
    ];

    elements.framesGrid.innerHTML = frames.map(frame => {
        const isUnlocked = profileData?.streak >= parseInt(frame.class.replace('day', ''));
        const isSelected = profileData?.avatar_frame === frame.class;

        return `
            <div class="frame-option ${!isUnlocked ? 'frame-locked' : ''} ${isSelected ? 'selected' : ''}" 
                 data-frame="${frame.class}"
                 onclick="${isUnlocked ? `selectFrame('${frame.class}')` : ''}">
                <div class="frame-preview avatar-frame ${frame.class}">
                    <img src="images/default-avatar.png" alt="Preview">
                </div>
                <div class="frame-name">${frame.name}</div>
                <div class="frame-requirement">
                    ${isUnlocked ? '✓ Unlocked' : '🔒 ' + frame.requirement}
                </div>
            </div>
        `;
    }).join('');

    elements.frameModal.classList.add('active');
}

// Close frame modal
function closeFrameModal() {
    if (elements.frameModal) {
        elements.frameModal.classList.remove('active');
    }
}

// Select frame
window.selectFrame = function(frameClass) {
    selectedFrame = frameClass;
    document.querySelectorAll('.frame-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.frame === frameClass);
    });
};

// Save frame
async function saveFrame() {
    if (!selectedFrame || !isOwnProfile) {
        closeFrameModal();
        return;
    }

    try {
        await supabase
            .from('profiles')
            .update({ avatar_frame: selectedFrame })
            .eq('id', currentUser.id);

        if (elements.avatarWrapper) {
            elements.avatarWrapper.className = `profile-avatar-wrapper avatar-frame ${selectedFrame}`;
        }

        notifications.success('Avatar frame updated!');
        closeFrameModal();
    } catch (error) {
        console.error('Error saving frame:', error);
        notifications.error('Failed to update frame');
    }
}

// Open edit modal
function openEditModal() {
    if (!elements.editProfileModal) return;

    if (elements.editName) {
        elements.editName.value = profileData?.full_name || profileData?.username || '';
    }
    if (elements.editBio) {
        elements.editBio.value = profileData?.bio || '';
    }
    if (elements.editFacebook) {
        elements.editFacebook.value = profileData?.facebook_url || '';
    }

    elements.editProfileModal.classList.add('active');
}

// Close edit modal
function closeEditModal() {
    if (elements.editProfileModal) {
        elements.editProfileModal.classList.remove('active');
    }
}

// Save profile
async function saveProfile(e) {
    e.preventDefault();

    const updates = {
        full_name: elements.editName?.value,
        bio: elements.editBio?.value,
        facebook_url: elements.editFacebook?.value
    };

    const result = await api.updateProfile(currentUser.id, updates);
    if (result.success) {
        if (elements.profileName) {
            elements.profileName.textContent = updates.full_name || profileData?.username;
        }
        if (elements.profileBio) {
            elements.profileBio.textContent = updates.bio || 'No bio yet.';
        }
        closeEditModal();
    }
}

// Filter library
function filterLibrary(e) {
    const filter = e.target.value;
    // Implement filtering logic
    console.log('Filtering by:', filter);
}

// Show error
function showError() {
    const container = document.querySelector('.profile-container');
    if (!container) return;

    container.innerHTML = `
        <div class="error-container">
            <i class="fas fa-exclamation-circle"></i>
            <h2>Profile not found</h2>
            <p>The user you're looking for doesn't exist.</p>
            <a href="../index.html" class="btn-primary">Go Home</a>
        </div>
    `;
}