// Admin Feedback Management
import { supabase, getCurrentUser } from '../../supabase.js';
import notifications from '../../notifications.js';
import { Utils } from '../../utils.js';

// DOM Elements
const elements = {
    feedbacksList: document.getElementById('feedbacksList'),
    statusFilter: document.getElementById('statusFilter'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    replyModal: document.getElementById('replyModal'),
    feedbackDetails: document.getElementById('feedbackDetails'),
    replyMessage: document.getElementById('replyMessage'),
    sendReplyBtn: document.getElementById('sendReplyBtn'),
    closeModalBtn: document.querySelector('#replyModal .btn-secondary'),
    pagination: document.getElementById('pagination')
};

// State
let currentFeedback = null;
let currentPage = 1;
let totalPages = 1;
const ITEMS_PER_PAGE = 20;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
    loadFeedbacks();
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
    if (elements.statusFilter) {
        elements.statusFilter.addEventListener('change', () => loadFeedbacks(1));
    }

    if (elements.searchBtn) {
        elements.searchBtn.addEventListener('click', () => loadFeedbacks(1));
    }

    if (elements.searchInput) {
        elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadFeedbacks(1);
        });
    }

    if (elements.sendReplyBtn) {
        elements.sendReplyBtn.addEventListener('click', sendReply);
    }

    if (elements.closeModalBtn) {
        elements.closeModalBtn.addEventListener('click', closeModal);
    }

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === elements.replyModal) {
            closeModal();
        }
    });
}

// Load feedbacks
async function loadFeedbacks(page = 1) {
    try {
        let query = supabase
            .from('user_feedback')
            .select(`
                *,
                profiles:user_id (id, username, avatar_url)
            `, { count: 'exact' });

        // Apply status filter
        if (elements.statusFilter?.value && elements.statusFilter.value !== 'all') {
            query = query.eq('status', elements.statusFilter.value);
        }

        // Apply search
        if (elements.searchInput?.value) {
            query = query.or(`message.ilike.%${elements.searchInput.value}%,profiles.username.ilike.%${elements.searchInput.value}%`);
        }

        // Pagination
        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        const { data: feedbacks, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        displayFeedbacks(feedbacks || []);
        updatePagination(page, Math.ceil((count || 0) / ITEMS_PER_PAGE));

    } catch (error) {
        console.error('Error loading feedbacks:', error);
        notifications.error('Failed to load feedbacks');
    }
}

// Display feedbacks
function displayFeedbacks(feedbacks) {
    if (!elements.feedbacksList) return;

    if (feedbacks.length === 0) {
        elements.feedbacksList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <i class="fas fa-inbox"></i>
                    <p>No feedbacks found</p>
                </td>
            </tr>
        `;
        return;
    }

    elements.feedbacksList.innerHTML = feedbacks.map(f => `
        <tr>
            <td>
                <div class="user-cell">
                    <img src="${f.profiles?.avatar_url || '../../images/default-avatar.png'}" 
                         alt="${f.profiles?.username || 'User'}" 
                         class="user-avatar">
                    <span>${f.profiles?.username || 'Anonymous'}</span>
                </div>
            </td>
            <td>
                <div class="message-preview">
                    <span class="message-text">${Utils.truncateText(Utils.escapeHtml(f.message), 100)}</span>
                    ${f.admin_reply ? '<span class="reply-indicator"><i class="fas fa-reply"></i> Replied</span>' : ''}
                </div>
            </td>
            <td>${Utils.timeAgo(f.created_at)}</td>
            <td>
                <span class="status-badge status-${f.status}">${f.status}</span>
            </td>
            <td>
                ${f.admin_reply ? 
                    `<span class="reply-preview">${Utils.truncateText(Utils.escapeHtml(f.admin_reply), 50)}</span>` : 
                    '<span class="no-reply">No reply yet</span>'}
            </td>
            <td>
                <div class="table-actions">
                    <button class="action-btn view" onclick="viewFeedback(${f.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${f.status !== 'replied' ? `
                        <button class="action-btn edit" onclick="replyToFeedback(${f.id})">
                            <i class="fas fa-reply"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn delete" onclick="archiveFeedback(${f.id})">
                        <i class="fas fa-archive"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// View feedback
window.viewFeedback = async function(id) {
    try {
        const { data: feedback, error } = await supabase
            .from('user_feedback')
            .select('*, profiles(username, email, avatar_url)')
            .eq('id', id)
            .single();

        if (error) throw error;

        currentFeedback = feedback;

        // Show feedback details in modal
        if (elements.feedbackDetails) {
            elements.feedbackDetails.innerHTML = `
                <div class="feedback-user">
                    <img src="${feedback.profiles?.avatar_url || '../../images/default-avatar.png'}" alt="">
                    <div>
                        <h4>${feedback.profiles?.username || 'Anonymous'}</h4>
                        <p>${feedback.profiles?.email || 'No email'}</p>
                    </div>
                </div>
                <div class="feedback-message">
                    <h5>Message:</h5>
                    <p>${Utils.escapeHtml(feedback.message)}</p>
                </div>
                <div class="feedback-meta">
                    <span><i class="fas fa-clock"></i> ${new Date(feedback.created_at).toLocaleString()}</span>
                    <span class="status-badge status-${feedback.status}">${feedback.status}</span>
                </div>
                ${feedback.admin_reply ? `
                    <div class="feedback-reply">
                        <h5>Admin Reply:</h5>
                        <p>${Utils.escapeHtml(feedback.admin_reply)}</p>
                        <small>Replied: ${Utils.timeAgo(feedback.replied_at)}</small>
                    </div>
                ` : ''}
            `;
        }

        if (elements.replyMessage) {
            elements.replyMessage.value = feedback.admin_reply || '';
        }

        openModal();

    } catch (error) {
        console.error('Error viewing feedback:', error);
        notifications.error('Failed to load feedback');
    }
};

// Reply to feedback
window.replyToFeedback = function(id) {
    viewFeedback(id);
};

// Send reply
async function sendReply() {
    if (!currentFeedback) return;

    const reply = elements.replyMessage?.value.trim();
    if (!reply) {
        notifications.warning('Please enter a reply');
        return;
    }

    try {
        const { error } = await supabase
            .from('user_feedback')
            .update({
                admin_reply: reply,
                status: 'replied',
                replied_at: new Date().toISOString()
            })
            .eq('id', currentFeedback.id);

        if (error) throw error;

        // Send notification to user
        if (currentFeedback.user_id) {
            await supabase
                .from('admin_notifications')
                .insert([{
                    user_id: currentFeedback.user_id,
                    message: `Admin replied to your feedback: "${Utils.truncateText(reply, 100)}"`,
                    type: 'info'
                }]);
        }

        notifications.success('Reply sent successfully');
        closeModal();
        loadFeedbacks(currentPage);

    } catch (error) {
        console.error('Error sending reply:', error);
        notifications.error('Failed to send reply');
    }
}

// Archive feedback
window.archiveFeedback = async function(id) {
    if (!confirm('Archive this feedback?')) return;

    try {
        const { error } = await supabase
            .from('user_feedback')
            .update({ status: 'archived' })
            .eq('id', id);

        if (error) throw error;

        notifications.success('Feedback archived');
        loadFeedbacks(currentPage);

    } catch (error) {
        console.error('Error archiving feedback:', error);
        notifications.error('Failed to archive feedback');
    }
};

// Delete feedback
window.deleteFeedback = async function(id) {
    if (!confirm('Permanently delete this feedback? This cannot be undone.')) return;

    try {
        const { error } = await supabase
            .from('user_feedback')
            .delete()
            .eq('id', id);

        if (error) throw error;

        notifications.success('Feedback deleted');
        loadFeedbacks(currentPage);

    } catch (error) {
        console.error('Error deleting feedback:', error);
        notifications.error('Failed to delete feedback');
    }
};

// Open modal
function openModal() {
    if (elements.replyModal) {
        elements.replyModal.classList.add('active');
    }
}

// Close modal
function closeModal() {
    if (elements.replyModal) {
        elements.replyModal.classList.remove('active');
        currentFeedback = null;
        if (elements.replyMessage) {
            elements.replyMessage.value = '';
        }
    }
}

// Update pagination
function updatePagination(page, total) {
    if (!elements.pagination) return;

    currentPage = page;
    totalPages = total;

    let html = '<div class="pagination">';
    
    // Previous button
    html += `<button class="page-btn" ${page === 1 ? 'disabled' : ''} onclick="loadFeedbacks(${page - 1})">
        <i class="fas fa-chevron-left"></i>
    </button>`;

    // Page numbers
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= page - 2 && i <= page + 2)) {
            html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="loadFeedbacks(${i})">${i}</button>`;
        } else if (i === page - 3 || i === page + 3) {
            html += '<span class="page-dots">...</span>';
        }
    }

    // Next button
    html += `<button class="page-btn" ${page === total ? 'disabled' : ''} onclick="loadFeedbacks(${page + 1})">
        <i class="fas fa-chevron-right"></i>
    </button>`;

    html += '</div>';

    elements.pagination.innerHTML = html;
}

// Bulk actions
window.bulkAction = async function(action) {
    const selected = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.value);

    if (selected.length === 0) {
        notifications.warning('No items selected');
        return;
    }

    if (!confirm(`Apply "${action}" to ${selected.length} items?`)) return;

    try {
        const { error } = await supabase
            .from('user_feedback')
            .update({ status: action })
            .in('id', selected);

        if (error) throw error;

        notifications.success(`Updated ${selected.length} feedbacks`);
        loadFeedbacks(currentPage);

    } catch (error) {
        console.error('Error in bulk action:', error);
        notifications.error('Failed to update feedbacks');
    }
};