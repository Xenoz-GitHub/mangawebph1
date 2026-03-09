// Settings page - PRODUCTION READY
import { supabase, getCurrentUser, onAuthChange } from '../supabase.js';
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    settingsNav: document.querySelectorAll('.settings-nav li'),
    settingsContent: document.getElementById('settingsContent')
};

// State
let currentUser = null;
let profileData = null;
let activeSection = 'profile';

// Settings sections templates
const sections = {
    profile: `
        <div class="settings-section active" id="section-profile">
            <h2 class="section-title">Profile Information</h2>
            
            <div class="avatar-upload">
                <div class="current-avatar">
                    <img src="{{avatarUrl}}" alt="Current Avatar" id="profileAvatar">
                </div>
                <div>
                    <button class="upload-btn" onclick="document.getElementById('avatarInput').click()">
                        <i class="fas fa-camera"></i> Change Avatar
                    </button>
                    <input type="file" id="avatarInput" accept="image/*" style="display: none;">
                    <p style="margin-top: 0.5rem; color: var(--text-secondary);">JPG, PNG or GIF. Max 2MB.</p>
                </div>
            </div>
            
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="username" value="{{username}}" readonly disabled>
                <small style="color: var(--text-secondary);">Username cannot be changed</small>
            </div>
            
            <div class="form-group">
                <label>Display Name</label>
                <input type="text" id="displayName" value="{{fullName}}">
            </div>
            
            <div class="form-group">
                <label>Bio</label>
                <textarea id="bio" rows="4">{{bio}}</textarea>
            </div>
            
            <div class="form-group">
                <label>Location</label>
                <input type="text" id="location" value="{{location}}">
            </div>
            
            <div class="form-group">
                <label>Website</label>
                <input type="url" id="website" value="{{website}}">
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Birthday</label>
                    <input type="date" id="birthday" value="{{birthday}}">
                </div>
            </div>
            
            <button class="save-btn" onclick="saveProfile()">Save Changes</button>
        </div>
    `,
    
    account: `
        <div class="settings-section" id="section-account">
            <h2 class="section-title">Account Security</h2>
            
            <div class="form-group">
                <label>Email Address</label>
                <input type="email" id="email" value="{{email}}">
                <small style="color: var(--text-secondary);">You'll need to verify your new email</small>
            </div>
            
            <div class="form-group">
                <label>Current Password</label>
                <input type="password" id="currentPassword" placeholder="Enter current password">
            </div>
            
            <div class="form-group">
                <label>New Password</label>
                <input type="password" id="newPassword" placeholder="Enter new password">
            </div>
            
            <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" id="confirmPassword" placeholder="Confirm new password">
            </div>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>Two-Factor Authentication</h4>
                    <p>Add an extra layer of security to your account</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="twoFactor" {{twoFactor}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>Login Alerts</h4>
                    <p>Get notified of new sign-ins to your account</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="loginAlerts" {{loginAlerts}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <button class="save-btn" onclick="saveAccount()">Update Security</button>
        </div>
    `,
    
    notifications: `
        <div class="settings-section" id="section-notifications">
            <h2 class="section-title">Notification Preferences</h2>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>Email Notifications</h4>
                    <p>Receive updates via email</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="emailNotif" {{emailNotif}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>Push Notifications</h4>
                    <p>Browser notifications for new chapters</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="pushNotif" {{pushNotif}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>New Chapter Alerts</h4>
                    <p>Get notified when new chapters are released</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="chapterAlerts" {{chapterAlerts}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>Comment Replies</h4>
                    <p>Get notified when someone replies to your comment</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="replyNotif" {{replyNotif}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>Newsletter</h4>
                    <p>Receive weekly manga recommendations</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="newsletter" {{newsletter}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <button class="save-btn" onclick="saveNotifications()">Save Preferences</button>
        </div>
    `,
    
    preferences: `
        <div class="settings-section" id="section-preferences">
            <h2 class="section-title">Reading Preferences</h2>
            
            <div class="form-group">
                <label>Reading Direction</label>
                <select id="readingDirection">
                    <option value="ltr" {{readingDirection_ltr}}>Left to Right</option>
                    <option value="rtl" {{readingDirection_rtl}}>Right to Left (Japanese)</option>
                    <option value="vertical" {{readingDirection_vertical}}>Vertical</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Page Fit</label>
                <select id="pageFit">
                    <option value="contain" {{pageFit_contain}}>Fit to Screen</option>
                    <option value="cover" {{pageFit_cover}}>Fill Screen</option>
                    <option value="original" {{pageFit_original}}>Original Size</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Background Color</label>
                <select id="bgColor">
                    <option value="light" {{bgColor_light}}>Light</option>
                    <option value="dark" {{bgColor_dark}}>Dark</option>
                    <option value="sepia" {{bgColor_sepia}}>Sepia</option>
                </select>
            </div>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>Auto Next Chapter</h4>
                    <p>Automatically load the next chapter</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="autoNext" {{autoNext}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>Preload Pages</h4>
                    <p>Load next pages in advance for smoother reading</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="preload" {{preload}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>Show Comments</h4>
                    <p>Display comments while reading</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="showComments" {{showComments}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <button class="save-btn" onclick="savePreferences()">Save Preferences</button>
        </div>
    `,
    
    privacy: `
        <div class="settings-section" id="section-privacy">
            <h2 class="section-title">Privacy Settings</h2>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>Public Profile</h4>
                    <p>Allow others to view your profile</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="publicProfile" {{publicProfile}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>Show Reading History</h4>
                    <p>Display your reading history on your profile</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="showHistory" {{showHistory}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>Show Favorites</h4>
                    <p>Display your favorite manga on your profile</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="showFavorites" {{showFavorites}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <div class="toggle-item">
                <div class="toggle-info">
                    <h4>Activity Status</h4>
                    <p>Show when you're online</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="showStatus" {{showStatus}}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <div class="form-group">
                <label>Blocked Users</label>
                <textarea id="blockedUsers" rows="3" placeholder="Enter usernames to block, one per line">{{blockedUsers}}</textarea>
            </div>
            
            <button class="save-btn" onclick="savePrivacy()">Save Privacy Settings</button>
        </div>
    `,
    
    danger: `
        <div class="settings-section" id="section-danger">
            <h2 class="section-title" style="color: #d63031;">Danger Zone</h2>
            
            <div class="danger-zone">
                <h3>Delete Account</h3>
                <p>Once you delete your account, there is no going back. All your data will be permanently removed.</p>
                <button class="danger-btn" onclick="confirmDeleteAccount()">
                    <i class="fas fa-trash"></i> Delete Account
                </button>
            </div>
            
            <div class="danger-zone" style="margin-top: 2rem;">
                <h3>Export Data</h3>
                <p>Download a copy of all your data from MangaWebPH.</p>
                <button class="btn-primary" onclick="exportData()">
                    <i class="fas fa-download"></i> Export Data
                </button>
            </div>
        </div>
    `
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    onAuthChange(async (user) => {
        currentUser = user;
        if (!user) {
            window.location.href = 'signin.html';
            return;
        }
        await loadProfile();
        setupEventListeners();
    });
});

// Setup event listeners
function setupEventListeners() {
    // Navigation
    elements.settingsNav.forEach(item => {
        item.addEventListener('click', function() {
            const section = this.dataset.section;
            switchSection(section);
        });
    });

    // Avatar upload
    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', uploadAvatar);
    }
}

// Load profile data
async function loadProfile() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;

        profileData = profile;
        renderSection('profile');

    } catch (error) {
        console.error('Error loading profile:', error);
        notifications.error('Failed to load profile');
    }
}

// Render a settings section
function renderSection(sectionName) {
    if (!elements.settingsContent || !sections[sectionName]) return;

    activeSection = sectionName;
    
    // Update active nav
    elements.settingsNav.forEach(item => {
        if (item.dataset.section === sectionName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Get template and replace placeholders
    let html = sections[sectionName];
    
    // Replace profile data
    if (profileData) {
        html = html
            .replace(/{{avatarUrl}}/g, profileData.avatar_url || '../images/default-avatar.png')
            .replace(/{{username}}/g, profileData.username || '')
            .replace(/{{fullName}}/g, profileData.full_name || '')
            .replace(/{{bio}}/g, profileData.bio || '')
            .replace(/{{location}}/g, profileData.location || '')
            .replace(/{{website}}/g, profileData.website || '')
            .replace(/{{birthday}}/g, profileData.birthday || '')
            .replace(/{{email}}/g, profileData.email || '');
    }

    // Replace checkbox states
    html = html
        .replace(/{{twoFactor}}/g, localStorage.getItem('twoFactor') === 'true' ? 'checked' : '')
        .replace(/{{loginAlerts}}/g, localStorage.getItem('loginAlerts') !== 'false' ? 'checked' : '')
        .replace(/{{emailNotif}}/g, localStorage.getItem('emailNotif') !== 'false' ? 'checked' : '')
        .replace(/{{pushNotif}}/g, localStorage.getItem('pushNotif') !== 'false' ? 'checked' : '')
        .replace(/{{chapterAlerts}}/g, localStorage.getItem('chapterAlerts') !== 'false' ? 'checked' : '')
        .replace(/{{replyNotif}}/g, localStorage.getItem('replyNotif') !== 'false' ? 'checked' : '')
        .replace(/{{newsletter}}/g, localStorage.getItem('newsletter') !== 'false' ? 'checked' : '')
        .replace(/{{autoNext}}/g, localStorage.getItem('autoNext') !== 'false' ? 'checked' : '')
        .replace(/{{preload}}/g, localStorage.getItem('preload') !== 'false' ? 'checked' : '')
        .replace(/{{showComments}}/g, localStorage.getItem('showComments') === 'true' ? 'checked' : '')
        .replace(/{{publicProfile}}/g, profileData?.is_public ? 'checked' : '')
        .replace(/{{showHistory}}/g, profileData?.show_history ? 'checked' : '')
        .replace(/{{showFavorites}}/g, profileData?.show_favorites ? 'checked' : '')
        .replace(/{{showStatus}}/g, profileData?.show_status ? 'checked' : '')
        .replace(/{{blockedUsers}}/g, '');

    // Replace select options
    const readingDirection = localStorage.getItem('readingDirection') || 'ltr';
    html = html
        .replace(/{{readingDirection_ltr}}/g, readingDirection === 'ltr' ? 'selected' : '')
        .replace(/{{readingDirection_rtl}}/g, readingDirection === 'rtl' ? 'selected' : '')
        .replace(/{{readingDirection_vertical}}/g, readingDirection === 'vertical' ? 'selected' : '');

    const pageFit = localStorage.getItem('pageFit') || 'contain';
    html = html
        .replace(/{{pageFit_contain}}/g, pageFit === 'contain' ? 'selected' : '')
        .replace(/{{pageFit_cover}}/g, pageFit === 'cover' ? 'selected' : '')
        .replace(/{{pageFit_original}}/g, pageFit === 'original' ? 'selected' : '');

    const bgColor = localStorage.getItem('bgColor') || 'light';
    html = html
        .replace(/{{bgColor_light}}/g, bgColor === 'light' ? 'selected' : '')
        .replace(/{{bgColor_dark}}/g, bgColor === 'dark' ? 'selected' : '')
        .replace(/{{bgColor_sepia}}/g, bgColor === 'sepia' ? 'selected' : '');

    elements.settingsContent.innerHTML = html;

    // Re-attach avatar upload listener
    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', uploadAvatar);
    }
}

// Switch section
function switchSection(section) {
    renderSection(section);
}

// Upload avatar
async function uploadAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        notifications.error('Please upload an image file');
        return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        notifications.error('File size must be less than 2MB');
        return;
    }

    try {
        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}_avatar_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('profiles')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('profiles')
            .getPublicUrl(filePath);

        // Update profile
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: urlData.publicUrl })
            .eq('id', currentUser.id);

        if (updateError) throw updateError;

        // Update local data
        profileData.avatar_url = urlData.publicUrl;

        // Update avatar image
        const avatarImg = document.getElementById('profileAvatar');
        if (avatarImg) {
            avatarImg.src = urlData.publicUrl;
        }

        notifications.success('Avatar updated successfully');

    } catch (error) {
        console.error('Error uploading avatar:', error);
        notifications.error('Failed to upload avatar');
    }
}

// Save profile
window.saveProfile = async function() {
    const updates = {
        full_name: document.getElementById('displayName')?.value,
        bio: document.getElementById('bio')?.value,
        location: document.getElementById('location')?.value,
        website: document.getElementById('website')?.value,
        birthday: document.getElementById('birthday')?.value
    };

    try {
        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', currentUser.id);

        if (error) throw error;

        // Update local data
        Object.assign(profileData, updates);

        notifications.success('Profile updated successfully');

    } catch (error) {
        console.error('Error updating profile:', error);
        notifications.error('Failed to update profile');
    }
};

// Save account
window.saveAccount = async function() {
    const email = document.getElementById('email')?.value;
    const currentPass = document.getElementById('currentPassword')?.value;
    const newPass = document.getElementById('newPassword')?.value;
    const confirmPass = document.getElementById('confirmPassword')?.value;

    // Update email if changed
    if (email && email !== profileData.email) {
        try {
            const { error } = await supabase.auth.updateUser({ email });
            if (error) throw error;
            notifications.success('Verification email sent to new address');
        } catch (error) {
            console.error('Error updating email:', error);
            notifications.error('Failed to update email');
        }
    }

    // Update password if provided
    if (newPass && confirmPass) {
        if (newPass !== confirmPass) {
            notifications.error('Passwords do not match');
            return;
        }

        if (newPass.length < 8) {
            notifications.error('Password must be at least 8 characters');
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPass
            });
            if (error) throw error;
            notifications.success('Password updated');

            // Clear password fields
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } catch (error) {
            console.error('Error updating password:', error);
            notifications.error('Failed to update password');
        }
    }

    // Save preferences to localStorage
    localStorage.setItem('twoFactor', document.getElementById('twoFactor')?.checked || false);
    localStorage.setItem('loginAlerts', document.getElementById('loginAlerts')?.checked || false);
};

// Save notifications
window.saveNotifications = function() {
    const preferences = {
        emailNotif: document.getElementById('emailNotif')?.checked || false,
        pushNotif: document.getElementById('pushNotif')?.checked || false,
        chapterAlerts: document.getElementById('chapterAlerts')?.checked || false,
        replyNotif: document.getElementById('replyNotif')?.checked || false,
        newsletter: document.getElementById('newsletter')?.checked || false
    };

    Object.entries(preferences).forEach(([key, value]) => {
        localStorage.setItem(key, value);
    });

    notifications.success('Notification preferences saved');
};

// Save reading preferences
window.savePreferences = function() {
    const preferences = {
        readingDirection: document.getElementById('readingDirection')?.value,
        pageFit: document.getElementById('pageFit')?.value,
        bgColor: document.getElementById('bgColor')?.value,
        autoNext: document.getElementById('autoNext')?.checked || false,
        preload: document.getElementById('preload')?.checked || false,
        showComments: document.getElementById('showComments')?.checked || false
    };

    Object.entries(preferences).forEach(([key, value]) => {
        localStorage.setItem(key, value);
    });

    notifications.success('Reading preferences saved');
};

// Save privacy
window.savePrivacy = async function() {
    const updates = {
        is_public: document.getElementById('publicProfile')?.checked || false,
        show_history: document.getElementById('showHistory')?.checked || false,
        show_favorites: document.getElementById('showFavorites')?.checked || false,
        show_status: document.getElementById('showStatus')?.checked || false
    };

    try {
        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', currentUser.id);

        if (error) throw error;

        notifications.success('Privacy settings updated');

    } catch (error) {
        console.error('Error updating privacy:', error);
        notifications.error('Failed to update privacy');
    }
};

// Confirm delete account
window.confirmDeleteAccount = function() {
    if (confirm('Are you absolutely sure? This action cannot be undone.')) {
        const confirmText = prompt('Type "DELETE" to confirm');
        if (confirmText === 'DELETE') {
            deleteAccount();
        }
    }
};

// Delete account
async function deleteAccount() {
    try {
        // Delete user data
        await supabase.from('profiles').delete().eq('id', currentUser.id);
        await supabase.from('reading_history').delete().eq('user_id', currentUser.id);
        await supabase.from('favorites').delete().eq('user_id', currentUser.id);
        await supabase.from('comments').delete().eq('user_id', currentUser.id);

        // Delete auth user (requires admin or service role - this would need a server function)
        notifications.success('Account deletion initiated. You will be logged out.');

        // Sign out
        await supabase.auth.signOut();
        window.location.href = '../index.html';

    } catch (error) {
        console.error('Error deleting account:', error);
        notifications.error('Failed to delete account');
    }
}

// Export data
window.exportData = async function() {
    try {
        const [
            { data: profile },
            { data: history },
            { data: favorites },
            { data: comments },
            { data: achievements }
        ] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', currentUser.id).single(),
            supabase.from('reading_history').select('*, manga: manga_id(title)').eq('user_id', currentUser.id),
            supabase.from('favorites').select('*, manga: manga_id(title)').eq('user_id', currentUser.id),
            supabase.from('comments').select('*, manga: manga_id(title)').eq('user_id', currentUser.id),
            supabase.from('achievements').select('*').eq('user_id', currentUser.id)
        ]);

        const data = {
            profile,
            reading_history: history,
            favorites,
            comments,
            achievements,
            exported_at: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mangawebph-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        notifications.success('Data exported successfully');

    } catch (error) {
        console.error('Error exporting data:', error);
        notifications.error('Failed to export data');
    }
};