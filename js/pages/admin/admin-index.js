// Admin Dashboard
import { supabase, getCurrentUser, onAuthChange } from '../../supabase.js';
import api from '../../api.js';
import notifications from '../../notifications.js';
import { Utils } from '../../utils.js';

// DOM Elements
const elements = {
    adminName: document.getElementById('adminName'),
    totalUsers: document.getElementById('totalUsers'),
    totalManga: document.getElementById('totalManga'),
    totalDonations: document.getElementById('totalDonations'),
    pendingFeedbacks: document.getElementById('pendingFeedbacks'),
    feedbacksBody: document.getElementById('feedbacksBody'),
    donationsBody: document.getElementById('donationsBody'),
    recentActivities: document.getElementById('recentActivities'),
    systemStatus: document.getElementById('systemStatus'),
    quickStats: document.querySelectorAll('.stat-card')
};

// State
let currentUser = getCurrentUser();
let charts = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkAdmin();
    await loadDashboard();
    setupEventListeners();
    initCharts();
    startRealtimeSubscriptions();

    // Listen for auth changes
    onAuthChange(async (user) => {
        currentUser = user;
        if (!user) {
            window.location.href = '../../index.html';
        } else {
            await checkAdmin();
        }
    });
});

// Check admin permissions
async function checkAdmin() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('is_admin, role')
            .eq('id', currentUser?.id)
            .single();

        if (error || !profile?.is_admin) {
            notifications.error('Access denied. Admin only.');
            window.location.href = '../../index.html';
            return false;
        }

        if (elements.adminName) {
            elements.adminName.textContent = currentUser.email;
        }
        return true;
    } catch (error) {
        console.error('Error checking admin:', error);
        return false;
    }
}

// Load dashboard data
async function loadDashboard() {
    try {
        // Load counts in parallel
        const [
            usersCount,
            mangaCount,
            donationsTotal,
            pendingFeedbacks,
            pendingDonations,
            recentActivity
        ] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true }),
            supabase.from('manga').select('*', { count: 'exact', head: true }),
            supabase.from('donations').select('amount').eq('status', 'approved'),
            supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('user_activities').select('*, profiles(username)').order('created_at', { ascending: false }).limit(10)
        ]);

        // Update stats
        if (elements.totalUsers) {
            elements.totalUsers.textContent = usersCount.count || 0;
        }

        if (elements.totalManga) {
            elements.totalManga.textContent = mangaCount.count || 0;
        }

        const totalDonationAmount = donationsTotal.data?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
        if (elements.totalDonations) {
            elements.totalDonations.textContent = `₱${totalDonationAmount.toLocaleString()}`;
        }

        if (elements.pendingFeedbacks) {
            elements.pendingFeedbacks.textContent = pendingFeedbacks.count || 0;
        }

        // Load recent feedbacks
        await loadRecentFeedbacks();
        
        // Load pending donations
        await loadPendingDonations();

        // Load recent activities
        if (elements.recentActivities && recentActivity.data) {
            displayRecentActivities(recentActivity.data);
        }

        // Update quick stats
        updateQuickStats({
            users: usersCount.count || 0,
            manga: mangaCount.count || 0,
            pendingDonations: pendingDonations.count || 0,
            pendingFeedbacks: pendingFeedbacks.count || 0
        });

    } catch (error) {
        console.error('Error loading dashboard:', error);
        notifications.error('Failed to load dashboard data');
    }
}

// Load recent feedbacks
async function loadRecentFeedbacks() {
    try {
        const { data: feedbacks, error } = await supabase
            .from('user_feedback')
            .select('*, profiles(username, avatar_url)')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!elements.feedbacksBody) return;

        if (!feedbacks || feedbacks.length === 0) {
            elements.feedbacksBody.innerHTML = '<tr><td colspan="5" class="text-center">No feedbacks yet</td></tr>';
            return;
        }

        elements.feedbacksBody.innerHTML = feedbacks.map(f => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${f.profiles?.avatar_url || '../../images/default-avatar.png'}" 
                             style="width: 30px; height: 30px; border-radius: 50%;">
                        <span>${f.profiles?.username || 'Anonymous'}</span>
                    </div>
                </td>
                <td>${Utils.truncateText(f.message, 50)}</td>
                <td>${Utils.timeAgo(f.created_at)}</td>
                <td><span class="status-badge status-${f.status}">${f.status}</span></td>
                <td>
                    <button class="action-btn view" onclick="window.viewFeedback(${f.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading feedbacks:', error);
    }
}

// Load pending donations
async function loadPendingDonations() {
    try {
        const { data: donations, error } = await supabase
            .from('donations')
            .select('*, profiles(username)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!elements.donationsBody) return;

        if (!donations || donations.length === 0) {
            elements.donationsBody.innerHTML = '<tr><td colspan="5" class="text-center">No pending donations</td></tr>';
            return;
        }

        elements.donationsBody.innerHTML = donations.map(d => `
            <tr>
                <td>${d.profiles?.username || 'Anonymous'}</td>
                <td>₱${d.amount.toLocaleString()}</td>
                <td><a href="${d.receipt_url}" target="_blank">View Receipt</a></td>
                <td>${Utils.timeAgo(d.created_at)}</td>
                <td>
                    <button class="action-btn approve" onclick="window.approveDonation(${d.id})">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="action-btn reject" onclick="window.rejectDonation(${d.id})">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading donations:', error);
    }
}

// Display recent activities
function displayRecentActivities(activities) {
    if (!elements.recentActivities) return;

    elements.recentActivities.innerHTML = activities.map(a => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas ${getActivityIcon(a.activity_type)}"></i>
            </div>
            <div class="activity-content">
                <p><strong>${a.profiles?.username || 'User'}</strong> ${getActivityText(a)}</p>
                <span class="activity-time">${Utils.timeAgo(a.created_at)}</span>
            </div>
        </div>
    `).join('');
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
        'collection': 'fa-layer-group',
        'cheat_used': 'fa-gamepad'
    };
    return icons[type] || 'fa-circle';
}

// Get activity text
function getActivityText(activity) {
    const data = activity.activity_data || {};
    switch(activity.activity_type) {
        case 'read': return `read a chapter`;
        case 'rating': return `rated a manga ${data.rating} stars`;
        case 'comment': return `commented on a manga`;
        case 'achievement': return `earned achievement: ${data.achievement || 'Unknown'}`;
        case 'follow': return `followed someone`;
        case 'favorite': return `added to favorites`;
        case 'cheat_used': return `used cheat code: ${data.code || 'Unknown'}`;
        default: return 'performed an activity';
    }
}

// Update quick stats
function updateQuickStats(stats) {
    document.querySelectorAll('.quick-stat .stat-value').forEach(el => {
        const stat = el.closest('.quick-stat')?.dataset.stat;
        if (stat && stats[stat]) {
            el.textContent = stats[stat].toLocaleString();
        }
    });
}

// Initialize charts
function initCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded');
        return;
    }

    // User Growth Chart
    const userCtx = document.getElementById('userGrowthChart')?.getContext('2d');
    if (userCtx) {
        charts.userGrowth = new Chart(userCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'New Users',
                    data: [65, 78, 90, 115, 145, 178],
                    borderColor: '#6c5ce7',
                    backgroundColor: 'rgba(108, 92, 231, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
                }
            }
        });
    }

    // Manga Views Chart
    const mangaCtx = document.getElementById('mangaViewsChart')?.getContext('2d');
    if (mangaCtx) {
        charts.mangaViews = new Chart(mangaCtx, {
            type: 'bar',
            data: {
                labels: ['One Piece', 'Naruto', 'Jujutsu', 'Demon Slayer', 'AOT', 'MHA'],
                datasets: [{
                    label: 'Views',
                    data: [12500, 9800, 8700, 8200, 7900, 7100],
                    backgroundColor: '#6c5ce7',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
                }
            }
        });
    }
}

// Start realtime subscriptions
function startRealtimeSubscriptions() {
    // Listen for new feedbacks
    const feedbackChannel = supabase
        .channel('admin-feedbacks')
        .on('INSERT', { schema: 'public', table: 'user_feedback' }, payload => {
            notifications.info('New feedback received!');
            loadRecentFeedbacks();
            updateNotificationBadge();
        })
        .subscribe();

    // Listen for new donations
    const donationChannel = supabase
        .channel('admin-donations')
        .on('INSERT', { schema: 'public', table: 'donations' }, payload => {
            notifications.info('New donation pending verification!');
            loadPendingDonations();
            updateNotificationBadge();
        })
        .subscribe();
}

// Update notification badge
async function updateNotificationBadge() {
    const [{ count: feedbackCount }, { count: donationCount }] = await Promise.all([
        supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    ]);

    const total = (feedbackCount || 0) + (donationCount || 0);
    const badge = document.querySelector('.notification-badge');
    
    if (badge) {
        if (total > 0) {
            badge.textContent = total;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// View feedback
window.viewFeedback = function(id) {
    window.location.href = `feedbacks.html?id=${id}`;
};

// Approve donation
window.approveDonation = async function(id) {
    if (!confirm('Approve this donation and grant premium access?')) return;

    try {
        // Get donation details
        const { data: donation, error: donationError } = await supabase
            .from('donations')
            .select('*, user_id')
            .eq('id', id)
            .single();

        if (donationError) throw donationError;

        // Update donation status
        const { error: updateError } = await supabase
            .from('donations')
            .update({ 
                status: 'approved',
                verified_at: new Date().toISOString(),
                verified_by: currentUser.id
            })
            .eq('id', id);

        if (updateError) throw updateError;

        // Grant premium to user
        if (donation.user_id) {
            await supabase
                .from('profiles')
                .update({ 
                    is_premium: true,
                    premium_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    premium_type: 'monthly'
                })
                .eq('id', donation.user_id);

            // Send notification
            await supabase
                .from('admin_notifications')
                .insert([{
                    user_id: donation.user_id,
                    message: 'Your donation has been approved! You now have premium access for 30 days.',
                    type: 'success'
                }]);
        }

        notifications.success('Donation approved! Premium granted.');
        loadPendingDonations();

    } catch (error) {
        console.error('Error approving donation:', error);
        notifications.error('Failed to approve donation');
    }
};

// Reject donation
window.rejectDonation = async function(id) {
    if (!confirm('Reject this donation?')) return;

    try {
        const { error } = await supabase
            .from('donations')
            .update({ status: 'rejected' })
            .eq('id', id);

        if (error) throw error;

        notifications.success('Donation rejected');
        loadPendingDonations();

    } catch (error) {
        console.error('Error rejecting donation:', error);
        notifications.error('Failed to reject donation');
    }
};

// Refresh data
window.refreshDashboard = function() {
    loadDashboard();
    notifications.info('Dashboard refreshed');
};

// Export data
window.exportData = async function(type) {
    try {
        let data, filename;

        switch(type) {
            case 'users':
                ({ data } = await supabase.from('profiles').select('*'));
                filename = 'users-export.json';
                break;
            case 'manga':
                ({ data } = await supabase.from('manga').select('*'));
                filename = 'manga-export.json';
                break;
            case 'donations':
                ({ data } = await supabase.from('donations').select('*, profiles(username)'));
                filename = 'donations-export.json';
                break;
            default:
                return;
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        notifications.success('Data exported successfully');
    } catch (error) {
        console.error('Error exporting data:', error);
        notifications.error('Failed to export data');
    }
};