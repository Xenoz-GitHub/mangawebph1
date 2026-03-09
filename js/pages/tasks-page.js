// Tasks page
import { supabase, getCurrentUser, onAuthChange } from '../supabase.js';
import api from '../api.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    streakCount: document.getElementById('streakCount'),
    streakCalendar: document.getElementById('streakCalendar'),
    tasksGrid: document.getElementById('tasksGrid'),
    achievementsPreview: document.getElementById('achievementsPreview')
};

// State
let currentUser = getCurrentUser();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        window.location.href = 'signin.html';
        return;
    }

    loadTasks();
    setupEventListeners();

    // Listen for auth changes
    onAuthChange((user) => {
        currentUser = user;
        if (!user) {
            window.location.href = 'signin.html';
        }
    });
});

// Setup event listeners
function setupEventListeners() {
    // Listen for task updates
    window.addEventListener('task-update', () => {
        loadTasks();
    });
}

// Load tasks
async function loadTasks() {
    try {
        const { data: tasks, error } = await api.getDailyTasks(currentUser.id);

        if (error) throw error;

        displayTasks(tasks);
        await loadStreak();
        await loadAchievementsPreview();

    } catch (error) {
        console.error('Error loading tasks:', error);
        notifications.error('Failed to load tasks');
    }
}

// Display tasks
function displayTasks(tasks) {
    if (!elements.tasksGrid) return;

    if (!tasks || tasks.length === 0) {
        elements.tasksGrid.innerHTML = `
            <div class="no-data">
                <i class="fas fa-tasks"></i>
                <p>No tasks available</p>
            </div>
        `;
        return;
    }

    elements.tasksGrid.innerHTML = tasks.map(task => {
        const progress = (task.current / task.target) * 100;
        const canClaim = task.current >= task.target && !task.completed;

        return `
            <div class="task-card ${task.completed ? 'completed' : ''}" id="task-${task.id}">
                <div class="task-icon">
                    <i class="fas ${task.icon}"></i>
                </div>
                <h3 class="task-title">${Utils.escapeHtml(task.title)}</h3>
                <p class="task-description">${Utils.escapeHtml(task.description)}</p>

                <div class="task-progress">
                    <div class="task-progress-bar">
                        <div class="task-progress-fill" style="width: ${progress}%;"></div>
                    </div>
                    <div class="task-progress-text">
                        <span>${task.current}/${task.target}</span>
                        <span>${Math.round(progress)}%</span>
                    </div>
                </div>

                <div class="task-footer">
                    <div class="task-reward">
                        <i class="fas fa-star"></i>
                        <span>+${task.reward} XP</span>
                    </div>

                    <button class="task-claim-btn" 
                            onclick="claimTask(${task.id})"
                            ${!canClaim ? 'disabled' : ''}
                            ${task.completed ? 'disabled' : ''}>
                        ${task.completed ? 'Claimed' : 'Claim'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Claim task reward
window.claimTask = async function(taskId) {
    try {
        const result = await api.claimTask(currentUser.id, taskId);
        if (result.success) {
            // Update task display
            const taskCard = document.getElementById(`task-${taskId}`);
            if (taskCard) {
                taskCard.classList.add('completed');
                const btn = taskCard.querySelector('.task-claim-btn');
                if (btn) {
                    btn.textContent = 'Claimed';
                    btn.disabled = true;
                }
            }

            // Show reward animation
            showRewardAnimation();
        }
    } catch (error) {
        console.error('Error claiming task:', error);
    }
};

// Show reward animation
function showRewardAnimation() {
    const notification = document.createElement('div');
    notification.className = 'xp-boost';
    notification.innerHTML = `
        <i class="fas fa-star"></i>
        <span>XP Earned!</span>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Load streak
async function loadStreak() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('streak, last_login')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;

        if (elements.streakCount) {
            elements.streakCount.textContent = profile.streak || 0;
        }

        // Generate calendar
        if (elements.streakCalendar) {
            const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
            elements.streakCalendar.innerHTML = days.map((day, index) => {
                const isActive = index < (profile.streak % 7);
                return `<div class="calendar-day ${isActive ? 'active' : ''}">${day}</div>`;
            }).join('');
        }

    } catch (error) {
        console.error('Error loading streak:', error);
    }
}

// Load achievements preview
async function loadAchievementsPreview() {
    if (!elements.achievementsPreview) return;

    try {
        const { data: achievements, error } = await supabase
            .from('achievements')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('unlocked_at', { ascending: false })
            .limit(4);

        if (error) throw error;

        if (!achievements || achievements.length === 0) {
            elements.achievementsPreview.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-trophy"></i>
                    <p>No achievements yet</p>
                </div>
            `;
            return;
        }

        elements.achievementsPreview.innerHTML = achievements.map(a => `
            <div class="achievement-item">
                <div class="achievement-icon">
                    <i class="fas fa-trophy"></i>
                </div>
                <div class="achievement-name">${Utils.escapeHtml(a.name)}</div>
                <div class="achievement-progress">${Utils.timeAgo(a.unlocked_at)}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading achievements:', error);
    }
}