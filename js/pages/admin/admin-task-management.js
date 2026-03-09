// Admin Task Management
import { supabase, getCurrentUser } from '../../supabase.js';
import notifications from '../../notifications.js';
import { Utils } from '../../utils.js';

// DOM Elements
const elements = {
    tasksList: document.getElementById('tasksList'),
    taskModal: document.getElementById('taskModal'),
    modalTitle: document.getElementById('modalTitle'),
    taskForm: document.getElementById('taskForm'),
    taskName: document.getElementById('taskName'),
    taskDescription: document.getElementById('taskDescription'),
    taskIcon: document.getElementById('taskIcon'),
    taskTarget: document.getElementById('taskTarget'),
    taskReward: document.getElementById('taskReward'),
    taskType: document.getElementById('taskType'),
    taskActive: document.getElementById('taskActive'),
    todayCompletions: document.getElementById('todayCompletions'),
    totalCompletions: document.getElementById('totalCompletions'),
    totalXPAwarded: document.getElementById('totalXPAwarded'),
    filterType: document.getElementById('filterType'),
    filterStatus: document.getElementById('filterStatus'),
    searchTask: document.getElementById('searchTask'),
    addTaskBtn: document.getElementById('addTaskBtn')
};

// State
let editingTaskId = null;
let tasks = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
    loadTasks();
    loadTaskStats();
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
    if (elements.addTaskBtn) {
        elements.addTaskBtn.addEventListener('click', showAddTaskModal);
    }

    if (elements.taskForm) {
        elements.taskForm.addEventListener('submit', saveTask);
    }

    if (elements.filterType) {
        elements.filterType.addEventListener('change', () => loadTasks());
    }

    if (elements.filterStatus) {
        elements.filterStatus.addEventListener('change', () => loadTasks());
    }

    if (elements.searchTask) {
        elements.searchTask.addEventListener('input', Utils.debounce(loadTasks, 500));
    }

    // Close modal buttons
    document.querySelectorAll('#taskModal .btn-secondary').forEach(btn => {
        btn.addEventListener('click', closeTaskModal);
    });

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === elements.taskModal) {
            closeTaskModal();
        }
    });
}

// Load tasks
async function loadTasks() {
    try {
        let query = supabase
            .from('tasks_definition')
            .select('*');

        // Apply type filter
        if (elements.filterType?.value && elements.filterType.value !== 'all') {
            query = query.eq('type', elements.filterType.value);
        }

        // Apply status filter
        if (elements.filterStatus?.value && elements.filterStatus.value !== 'all') {
            const isActive = elements.filterStatus.value === 'active';
            query = query.eq('active', isActive);
        }

        // Apply search
        if (elements.searchTask?.value) {
            query = query.or(`name.ilike.%${elements.searchTask.value}%,description.ilike.%${elements.searchTask.value}%`);
        }

        const { data: tasksData, error } = await query.order('created_at');

        if (error) throw error;

        tasks = tasksData || [];
        displayTasks();

    } catch (error) {
        console.error('Error loading tasks:', error);
        notifications.error('Failed to load tasks');
    }
}

// Display tasks
function displayTasks() {
    if (!elements.tasksList) return;

    if (tasks.length === 0) {
        elements.tasksList.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <i class="fas fa-tasks"></i>
                    <p>No tasks found</p>
                </td>
            </tr>
        `;
        return;
    }

    elements.tasksList.innerHTML = tasks.map(task => `
        <tr>
            <td>
                <div class="task-name">
                    <i class="fas ${task.icon || 'fa-tasks'}" style="color: var(--primary);"></i>
                    <span>${Utils.escapeHtml(task.name)}</span>
                </div>
            </td>
            <td>${Utils.truncateText(Utils.escapeHtml(task.description), 100)}</td>
            <td>${task.target}</td>
            <td>${task.reward_xp} XP</td>
            <td><span class="task-type">${task.type}</span></td>
            <td>
                <span class="status-badge ${task.active ? 'status-active' : 'status-inactive'}">
                    ${task.active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="action-btn view" onclick="viewTaskStats(${task.id})">
                        <i class="fas fa-chart-bar"></i>
                    </button>
                    <button class="action-btn edit" onclick="editTask(${task.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteTask(${task.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Show add task modal
function showAddTaskModal() {
    editingTaskId = null;
    if (elements.modalTitle) {
        elements.modalTitle.textContent = 'Add New Task';
    }
    resetForm();
    if (elements.taskModal) {
        elements.taskModal.classList.add('active');
    }
}

// Edit task
window.editTask = async function(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    editingTaskId = id;
    if (elements.modalTitle) {
        elements.modalTitle.textContent = 'Edit Task';
    }

    if (elements.taskName) elements.taskName.value = task.name;
    if (elements.taskDescription) elements.taskDescription.value = task.description;
    if (elements.taskIcon) elements.taskIcon.value = task.icon || 'fa-tasks';
    if (elements.taskTarget) elements.taskTarget.value = task.target;
    if (elements.taskReward) elements.taskReward.value = task.reward_xp;
    if (elements.taskType) elements.taskType.value = task.type;
    if (elements.taskActive) elements.taskActive.checked = task.active;

    if (elements.taskModal) {
        elements.taskModal.classList.add('active');
    }
};

// Save task
async function saveTask(e) {
    e.preventDefault();

    const taskData = {
        name: elements.taskName?.value.trim(),
        description: elements.taskDescription?.value.trim(),
        icon: elements.taskIcon?.value,
        target: parseInt(elements.taskTarget?.value),
        reward_xp: parseInt(elements.taskReward?.value),
        type: elements.taskType?.value,
        active: elements.taskActive?.checked
    };

    if (!taskData.name || !taskData.target || !taskData.reward_xp) {
        notifications.warning('Please fill all required fields');
        return;
    }

    try {
        if (editingTaskId) {
            // Update existing task
            const { error } = await supabase
                .from('tasks_definition')
                .update({
                    ...taskData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingTaskId);

            if (error) throw error;
            notifications.success('Task updated successfully');
        } else {
            // Create new task
            const { error } = await supabase
                .from('tasks_definition')
                .insert([{
                    ...taskData,
                    created_at: new Date().toISOString()
                }]);

            if (error) throw error;
            notifications.success('Task created successfully');
        }

        closeTaskModal();
        loadTasks();

    } catch (error) {
        console.error('Error saving task:', error);
        notifications.error('Failed to save task');
    }
}

// Delete task
window.deleteTask = async function(id) {
    if (!confirm('Delete this task? This will also remove it from users\' daily tasks.')) return;

    try {
        const { error } = await supabase
            .from('tasks_definition')
            .delete()
            .eq('id', id);

        if (error) throw error;

        notifications.success('Task deleted');
        loadTasks();

    } catch (error) {
        console.error('Error deleting task:', error);
        notifications.error('Failed to delete task');
    }
};

// View task statistics
window.viewTaskStats = async function(id) {
    try {
        const { data: completions, error } = await supabase
            .from('daily_tasks')
            .select('*')
            .eq('task_id', id)
            .eq('completed', true);

        if (error) throw error;

        const totalCompletions = completions?.length || 0;
        const totalXP = completions?.reduce((sum, t) => sum + t.reward, 0) || 0;

        // Get completion by day
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const dailyStats = last7Days.map(date => ({
            date,
            count: completions?.filter(c => c.date === date).length || 0
        }));

        alert(`Task Statistics:
            Total Completions: ${totalCompletions}
            Total XP Awarded: ${totalXP}
            Last 7 Days: ${dailyStats.map(d => `${d.date}: ${d.count}`).join(', ')}
        `);

    } catch (error) {
        console.error('Error loading task stats:', error);
        notifications.error('Failed to load task statistics');
    }
};

// Load task statistics
async function loadTaskStats() {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Today's completions
        const { count: todayCount } = await supabase
            .from('daily_tasks')
            .select('*', { count: 'exact', head: true })
            .eq('date', today)
            .eq('completed', true);

        // Total completions
        const { count: totalCount } = await supabase
            .from('daily_tasks')
            .select('*', { count: 'exact', head: true })
            .eq('completed', true);

        // Total XP awarded
        const { data: completions } = await supabase
            .from('daily_tasks')
            .select('reward')
            .eq('completed', true);

        const totalXP = completions?.reduce((sum, t) => sum + t.reward, 0) || 0;

        if (elements.todayCompletions) {
            elements.todayCompletions.textContent = todayCount || 0;
        }
        if (elements.totalCompletions) {
            elements.totalCompletions.textContent = totalCount || 0;
        }
        if (elements.totalXPAwarded) {
            elements.totalXPAwarded.textContent = totalXP;
        }

    } catch (error) {
        console.error('Error loading task stats:', error);
    }
}

// Close modal
function closeTaskModal() {
    if (elements.taskModal) {
        elements.taskModal.classList.remove('active');
    }
    resetForm();
    editingTaskId = null;
}

// Reset form
function resetForm() {
    if (elements.taskForm) {
        elements.taskForm.reset();
    }
    if (elements.taskIcon) {
        elements.taskIcon.value = 'fa-tasks';
    }
    if (elements.taskActive) {
        elements.taskActive.checked = true;
    }
}

// Bulk actions
window.bulkAction = async function(action) {
    const selected = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.value);

    if (selected.length === 0) {
        notifications.warning('No tasks selected');
        return;
    }

    if (!confirm(`Apply "${action}" to ${selected.length} tasks?`)) return;

    try {
        if (action === 'delete') {
            const { error } = await supabase
                .from('tasks_definition')
                .delete()
                .in('id', selected);

            if (error) throw error;
        } else {
            const isActive = action === 'activate';
            const { error } = await supabase
                .from('tasks_definition')
                .update({ active: isActive })
                .in('id', selected);

            if (error) throw error;
        }

        notifications.success(`Updated ${selected.length} tasks`);
        loadTasks();

    } catch (error) {
        console.error('Error in bulk action:', error);
        notifications.error('Failed to update tasks');
    }
};

// Export tasks
window.exportTasks = function() {
    const data = tasks.map(t => ({
        name: t.name,
        description: t.description,
        type: t.type,
        target: t.target,
        reward_xp: t.reward_xp,
        active: t.active
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    notifications.success('Tasks exported');
};

// Import tasks
window.importTasks = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const tasks = JSON.parse(event.target.result);
                
                for (const task of tasks) {
                    await supabase
                        .from('tasks_definition')
                        .insert([{
                            ...task,
                            created_at: new Date().toISOString()
                        }]);
                }

                notifications.success(`Imported ${tasks.length} tasks`);
                loadTasks();

            } catch (error) {
                console.error('Error importing tasks:', error);
                notifications.error('Failed to import tasks');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};