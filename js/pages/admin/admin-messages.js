// Admin Broadcast Messages
import { supabase, getCurrentUser } from '../../supabase.js';
import notifications from '../../notifications.js';
import { Utils } from '../../utils.js';

// DOM Elements
const elements = {
    messagesList: document.getElementById('messagesList'),
    messageModal: document.getElementById('messageModal'),
    messageTitle: document.getElementById('messageTitle'),
    messageContent: document.getElementById('messageContent'),
    targetAudience: document.getElementById('targetAudience'),
    userSelection: document.getElementById('userSelection'),
    userSelect: document.getElementById('userSelect'),
    excludeReading: document.getElementById('excludeReading'),
    scheduleDate: document.getElementById('scheduleDate'),
    scheduleTime: document.getElementById('scheduleTime'),
    sendBtn: document.getElementById('sendMessageBtn'),
    cancelBtn: document.getElementById('cancelMessageBtn'),
    historyFilter: document.getElementById('historyFilter'),
    searchHistory: document.getElementById('searchHistory')
};

// State
let selectedUsers = new Set();
let scheduledMessages = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
    loadMessages();
    loadUsers();
    loadScheduledMessages();
    setupEventListeners();
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
    if (elements.targetAudience) {
        elements.targetAudience.addEventListener('change', handleAudienceChange);
    }

    if (elements.sendBtn) {
        elements.sendBtn.addEventListener('click', sendMessage);
    }

    if (elements.cancelBtn) {
        elements.cancelBtn.addEventListener('click', closeModal);
    }

    if (elements.historyFilter) {
        elements.historyFilter.addEventListener('change', () => loadMessages());
    }

    if (elements.searchHistory) {
        elements.searchHistory.addEventListener('input', Utils.debounce(loadMessages, 500));
    }

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === elements.messageModal) {
            closeModal();
        }
    });
}

// Handle audience change
function handleAudienceChange() {
    const audience = elements.targetAudience?.value;
    
    if (elements.userSelection) {
        elements.userSelection.style.display = audience === 'specific' ? 'block' : 'none';
    }

    if (audience === 'specific' && elements.userSelect) {
        updateUserSelection();
    }
}

// Load users for selection
async function loadUsers() {
    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, username, email, is_premium')
            .order('username');

        if (error) throw error;

        if (elements.userSelect) {
            elements.userSelect.innerHTML = users.map(u => `
                <option value="${u.id}">
                    ${u.username} (${u.email}) ${u.is_premium ? '⭐' : ''}
                </option>
            `).join('');
        }

    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Update user selection
function updateUserSelection() {
    if (!elements.userSelect) return;

    const options = Array.from(elements.userSelect.options);
    selectedUsers.clear();

    options.forEach(opt => {
        if (opt.selected) {
            selectedUsers.add(opt.value);
        }
    });
}

// Load message history
async function loadMessages() {
    try {
        let query = supabase
            .from('admin_messages')
            .select(`
                *,
                profiles:created_by (username)
            `)
            .order('created_at', { ascending: false });

        // Apply filter
        if (elements.historyFilter?.value && elements.historyFilter.value !== 'all') {
            const days = parseInt(elements.historyFilter.value);
            const date = new Date();
            date.setDate(date.getDate() - days);
            query = query.gte('created_at', date.toISOString());
        }

        // Apply search
        if (elements.searchHistory?.value) {
            query = query.or(`title.ilike.%${elements.searchHistory.value}%,message.ilike.%${elements.searchHistory.value}%`);
        }

        const { data: messages, error } = await query;

        if (error) throw error;

        displayMessages(messages || []);

    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Display messages
function displayMessages(messages) {
    if (!elements.messagesList) return;

    if (messages.length === 0) {
        elements.messagesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-envelope-open"></i>
                <p>No broadcast messages yet</p>
            </div>
        `;
        return;
    }

    elements.messagesList.innerHTML = messages.map(m => {
        const targetText = getTargetText(m);
        const stats = getMessageStats(m);

        return `
            <div class="message-card">
                <div class="message-header">
                    <h3>${Utils.escapeHtml(m.title)}</h3>
                    <span class="message-date">${Utils.timeAgo(m.created_at)}</span>
                </div>
                <p class="message-content">${Utils.escapeHtml(m.message)}</p>
                <div class="message-meta">
                    <span><i class="fas fa-bullseye"></i> ${targetText}</span>
                    <span><i class="fas fa-user"></i> Sent by: ${m.profiles?.username || 'Admin'}</span>
                </div>
                <div class="message-stats">
                    <div class="stat">
                        <span class="stat-value">${stats.sent}</span>
                        <span class="stat-label">Sent</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${stats.delivered}</span>
                        <span class="stat-label">Delivered</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${stats.read}</span>
                        <span class="stat-label">Read</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${stats.clicked}</span>
                        <span class="stat-label">Clicked</span>
                    </div>
                </div>
                <div class="message-actions">
                    <button class="action-btn view" onclick="viewMessageStats(${m.id})">
                        <i class="fas fa-chart-bar"></i> View Stats
                    </button>
                    <button class="action-btn edit" onclick="resendMessage(${m.id})">
                        <i class="fas fa-redo"></i> Resend
                    </button>
                    <button class="action-btn delete" onclick="deleteMessage(${m.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Get target text
function getTargetText(message) {
    if (message.target_all) return 'All Users';
    if (message.target_premium) return 'Premium Users';
    if (message.target_users) {
        const count = message.target_users.length;
        return `${count} specific user${count !== 1 ? 's' : ''}`;
    }
    return 'Unknown';
}

// Get message stats
function getMessageStats(message) {
    // In production, you'd have actual stats
    return {
        sent: message.target_users?.length || 0,
        delivered: Math.floor((message.target_users?.length || 0) * 0.95),
        read: Math.floor((message.target_users?.length || 0) * 0.8),
        clicked: Math.floor((message.target_users?.length || 0) * 0.3)
    };
}

// Load scheduled messages
async function loadScheduledMessages() {
    try {
        const { data: messages, error } = await supabase
            .from('admin_messages')
            .select('*')
            .is('scheduled_for', 'not.null')
            .gt('scheduled_for', new Date().toISOString())
            .order('scheduled_for', { ascending: true });

        if (error) throw error;

        scheduledMessages = messages || [];
        displayScheduledMessages();

    } catch (error) {
        console.error('Error loading scheduled messages:', error);
    }
}

// Display scheduled messages
function displayScheduledMessages() {
    const container = document.getElementById('scheduledMessages');
    if (!container) return;

    if (scheduledMessages.length === 0) {
        container.innerHTML = '<p class="no-scheduled">No scheduled messages</p>';
        return;
    }

    container.innerHTML = scheduledMessages.map(m => `
        <div class="scheduled-item">
            <div class="scheduled-info">
                <h4>${Utils.escapeHtml(m.title)}</h4>
                <p>${Utils.truncateText(Utils.escapeHtml(m.message), 100)}</p>
                <span class="scheduled-time">
                    <i class="fas fa-clock"></i> ${new Date(m.scheduled_for).toLocaleString()}
                </span>
            </div>
            <div class="scheduled-actions">
                <button class="action-btn edit" onclick="editScheduled(${m.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete" onclick="cancelScheduled(${m.id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Show new message modal
window.showNewMessageModal = function() {
    if (elements.messageModal) {
        elements.messageModal.classList.add('active');
        resetForm();
    }
};

// Close modal
function closeModal() {
    if (elements.messageModal) {
        elements.messageModal.classList.remove('active');
        resetForm();
    }
}

// Reset form
function resetForm() {
    if (elements.messageTitle) elements.messageTitle.value = '';
    if (elements.messageContent) elements.messageContent.value = '';
    if (elements.targetAudience) elements.targetAudience.value = 'all';
    if (elements.userSelection) elements.userSelection.style.display = 'none';
    if (elements.excludeReading) elements.excludeReading.checked = false;
    if (elements.scheduleDate) elements.scheduleDate.value = '';
    if (elements.scheduleTime) elements.scheduleTime.value = '';
    selectedUsers.clear();
}

// Send message
async function sendMessage() {
    const title = elements.messageTitle?.value.trim();
    const content = elements.messageContent?.value.trim();
    const audience = elements.targetAudience?.value;
    const excludeReading = elements.excludeReading?.checked;
    const scheduleDate = elements.scheduleDate?.value;
    const scheduleTime = elements.scheduleTime?.value;

    if (!title || !content) {
        notifications.warning('Please fill in all fields');
        return;
    }

    let targetUsers = [];

    try {
        // Get target users based on audience
        switch(audience) {
            case 'all':
                const { data: allUsers } = await supabase
                    .from('profiles')
                    .select('id');
                targetUsers = allUsers.map(u => u.id);
                break;

            case 'premium':
                const { data: premiumUsers } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('is_premium', true);
                targetUsers = premiumUsers.map(u => u.id);
                break;

            case 'active':
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                
                const { data: activeUsers } = await supabase
                    .from('profiles')
                    .select('id')
                    .gte('last_login', sevenDaysAgo.toISOString());
                targetUsers = activeUsers.map(u => u.id);
                break;

            case 'specific':
                targetUsers = Array.from(selectedUsers);
                break;
        }

        // Exclude reading users if checked
        if (excludeReading) {
            const { data: readingUsers } = await supabase
                .from('reading_history')
                .select('user_id')
                .gte('last_read', new Date(Date.now() - 30 * 60 * 1000).toISOString());

            const readingIds = new Set(readingUsers.map(r => r.user_id));
            targetUsers = targetUsers.filter(id => !readingIds.has(id));
        }

        // Prepare message data
        const messageData = {
            title,
            message: content,
            target_all: audience === 'all',
            target_premium: audience === 'premium',
            target_users: targetUsers,
            exclude_reading: excludeReading,
            created_by: getCurrentUser()?.id,
            created_at: new Date().toISOString()
        };

        // Add scheduling if specified
        if (scheduleDate && scheduleTime) {
            messageData.scheduled_for = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
        }

        // Save message
        const { data: savedMessage, error } = await supabase
            .from('admin_messages')
            .insert([messageData])
            .select()
            .single();

        if (error) throw error;

        // If not scheduled, send immediately
        if (!messageData.scheduled_for) {
            await sendNotifications(targetUsers, savedMessage);
        }

        notifications.success(messageData.scheduled_for ? 
            'Message scheduled successfully' : 
            `Message sent to ${targetUsers.length} users`
        );

        closeModal();
        loadMessages();
        loadScheduledMessages();

    } catch (error) {
        console.error('Error sending message:', error);
        notifications.error('Failed to send message');
    }
}

// Send notifications to users
async function sendNotifications(userIds, message) {
    const notifications = userIds.map(userId => ({
        user_id: userId,
        message: message.message,
        type: 'info',
        data: { message_id: message.id, title: message.title },
        created_at: new Date().toISOString()
    }));

    // Send in batches of 100
    for (let i = 0; i < notifications.length; i += 100) {
        const batch = notifications.slice(i, i + 100);
        const { error } = await supabase
            .from('admin_notifications')
            .insert(batch);

        if (error) console.error('Error sending notification batch:', error);
    }
}

// View message stats
window.viewMessageStats = async function(id) {
    try {
        const { data: message, error } = await supabase
            .from('admin_messages')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Get delivery stats
        const { data: notifications } = await supabase
            .from('admin_notifications')
            .select('*')
            .eq('data->message_id', id);

        const stats = {
            sent: message.target_users?.length || 0,
            delivered: notifications?.length || 0,
            read: notifications?.filter(n => n.read).length || 0,
            clicked: 0 // You'd track this separately
        };

        // Show stats modal
        alert(`Message Stats:
            Sent: ${stats.sent}
            Delivered: ${stats.delivered}
            Read: ${stats.read}
            Clicked: ${stats.clicked}
        `);

    } catch (error) {
        console.error('Error loading message stats:', error);
    }
};

// Resend message
window.resendMessage = async function(id) {
    if (!confirm('Resend this message?')) return;

    try {
        const { data: message, error } = await supabase
            .from('admin_messages')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        await sendNotifications(message.target_users, message);
        notifications.success('Message resent');

    } catch (error) {
        console.error('Error resending message:', error);
        notifications.error('Failed to resend message');
    }
};

// Delete message
window.deleteMessage = async function(id) {
    if (!confirm('Delete this message?')) return;

    try {
        const { error } = await supabase
            .from('admin_messages')
            .delete()
            .eq('id', id);

        if (error) throw error;

        notifications.success('Message deleted');
        loadMessages();

    } catch (error) {
        console.error('Error deleting message:', error);
        notifications.error('Failed to delete message');
    }
};

// Edit scheduled message
window.editScheduled = function(id) {
    const message = scheduledMessages.find(m => m.id === id);
    if (!message) return;

    if (elements.messageTitle) elements.messageTitle.value = message.title;
    if (elements.messageContent) elements.messageContent.value = message.message;
    
    const scheduledDate = new Date(message.scheduled_for);
    if (elements.scheduleDate) {
        elements.scheduleDate.value = scheduledDate.toISOString().split('T')[0];
    }
    if (elements.scheduleTime) {
        elements.scheduleTime.value = scheduledDate.toTimeString().slice(0, 5);
    }

    showNewMessageModal();
};

// Cancel scheduled message
window.cancelScheduled = async function(id) {
    if (!confirm('Cancel this scheduled message?')) return;

    try {
        const { error } = await supabase
            .from('admin_messages')
            .update({ scheduled_for: null })
            .eq('id', id);

        if (error) throw error;

        notifications.success('Scheduled message cancelled');
        loadScheduledMessages();

    } catch (error) {
        console.error('Error cancelling message:', error);
        notifications.error('Failed to cancel message');
    }
};