// Admin Fun Zone - Cheat Codes Management
import { supabase, getCurrentUser } from '../../supabase.js';
import notifications from '../../notifications.js';
import { Utils } from '../../utils.js';

// DOM Elements
const elements = {
    cheatGrid: document.getElementById('cheatGrid'),
    activeEffects: document.getElementById('activeEffects'),
    cheatHistory: document.getElementById('cheatHistory'),
    codeInput: document.getElementById('cheatCodeInput'),
    applyBtn: document.getElementById('applyCheatBtn'),
    resetBtn: document.getElementById('resetCheatBtn'),
    customStatForm: document.getElementById('customStatForm'),
    targetUser: document.getElementById('targetUser'),
    statName: document.getElementById('statName'),
    statValue: document.getElementById('statValue'),
    glowTitle: document.getElementById('glowTitle'),
    glowColor: document.getElementById('glowColor'),
    glowIntensity: document.getElementById('glowIntensity'),
    applyGlowBtn: document.getElementById('applyGlowBtn'),
    resetUserBtn: document.getElementById('resetUserBtn'),
    cheatTabs: document.querySelectorAll('.cheat-tab'),
    cheatPanels: document.querySelectorAll('.cheat-panel')
};

// State
let activeCheats = [];
let cheatLogs = [];
let currentUser = getCurrentUser();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
    loadCheatCodes();
    loadActiveEffects();
    loadCheatHistory();
    setupEventListeners();
    loadUsers();
});

// Check admin access
async function checkAdminAccess() {
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, role')
        .eq('id', currentUser?.id)
        .single();

    if (!profile?.is_admin) {
        notifications.error('Access denied. Admin only.');
        window.location.href = '../../index.html';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Apply cheat code
    if (elements.applyBtn) {
        elements.applyBtn.addEventListener('click', applyCheatCode);
    }

    // Reset cheat effects
    if (elements.resetBtn) {
        elements.resetBtn.addEventListener('click', resetCheatEffects);
    }

    // Apply glow title
    if (elements.applyGlowBtn) {
        elements.applyGlowBtn.addEventListener('click', applyGlowTitle);
    }

    // Reset user
    if (elements.resetUserBtn) {
        elements.resetUserBtn.addEventListener('click', resetUser);
    }

    // Custom stat form
    if (elements.customStatForm) {
        elements.customStatForm.addEventListener('submit', applyCustomStat);
    }

    // Cheat code input (Konami code style)
    if (elements.codeInput) {
        elements.codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyCheatCode();
        });
    }

    // Tabs
    elements.cheatTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.target;
            elements.cheatTabs.forEach(t => t.classList.remove('active'));
            elements.cheatPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(target)?.classList.add('active');
        });
    });
}

// Load users for targeting
async function loadUsers() {
    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, username, email')
            .order('username');

        if (error) throw error;

        if (elements.targetUser) {
            elements.targetUser.innerHTML = `
                <option value="">Select User (leave empty for self)</option>
                ${users.map(u => `
                    <option value="${u.id}">${u.username} (${u.email})</option>
                `).join('')}
            `;
        }

    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Load cheat codes
async function loadCheatCodes() {
    try {
        const { data: cheats, error } = await supabase
            .from('cheat_codes')
            .select('*')
            .order('name');

        if (error) throw error;

        displayCheatCodes(cheats || []);

    } catch (error) {
        console.error('Error loading cheat codes:', error);
    }
}

// Display cheat codes
function displayCheatCodes(cheats) {
    if (!elements.cheatGrid) return;

    elements.cheatGrid.innerHTML = cheats.map(cheat => `
        <div class="cheat-card" data-code="${cheat.code}">
            <div class="cheat-header">
                <span class="cheat-code">${cheat.code}</span>
                <span class="cheat-type">${cheat.effect_type}</span>
            </div>
            <h3 class="cheat-name">${cheat.name}</h3>
            <p class="cheat-desc">${cheat.description}</p>
            <div class="cheat-meta">
                <span><i class="fas fa-clock"></i> ${cheat.duration ? cheat.duration + ' min' : 'Permanent'}</span>
                <span><i class="fas fa-users"></i> ${cheat.target_self ? 'Self' : ''} ${cheat.target_others ? 'Others' : ''}</span>
                <span><i class="fas fa-tachometer-alt"></i> Uses: ${cheat.uses_remaining === -1 ? '∞' : cheat.uses_remaining}</span>
            </div>
            <button class="cheat-use-btn" onclick="useCheatCode('${cheat.code}')">
                <i class="fas fa-bolt"></i> Use Cheat
            </button>
        </div>
    `).join('');
}

// Load active effects
async function loadActiveEffects() {
    try {
        const { data: effects, error } = await supabase
            .from('cheat_logs')
            .select(`
                *,
                cheat:cheat_id (*),
                target:target_user_id (username),
                activator:activated_by (username)
            `)
            .eq('is_active', true)
            .order('activated_at', { ascending: false });

        if (error) throw error;

        activeCheats = effects || [];
        displayActiveEffects();

    } catch (error) {
        console.error('Error loading active effects:', error);
    }
}

// Display active effects
function displayActiveEffects() {
    if (!elements.activeEffects) return;

    if (activeCheats.length === 0) {
        elements.activeEffects.innerHTML = '<p class="no-effects">No active cheat effects</p>';
        return;
    }

    elements.activeEffects.innerHTML = activeCheats.map(effect => {
        const expiresIn = effect.expires_at ? 
            Math.round((new Date(effect.expires_at) - new Date()) / 60000) : 
            'Permanent';

        return `
            <div class="effect-card">
                <div class="effect-header">
                    <span class="effect-name">${effect.cheat?.name || 'Unknown'}</span>
                    <span class="effect-badge ${effect.cheat?.effect_type}">${effect.cheat?.effect_type}</span>
                </div>
                <div class="effect-target">
                    <i class="fas fa-user"></i> ${effect.target?.username || 'Unknown'}
                </div>
                <div class="effect-time">
                    <i class="fas fa-clock"></i> Activated: ${Utils.timeAgo(effect.activated_at)}
                </div>
                <div class="effect-expiry">
                    <i class="fas fa-hourglass-half"></i> Expires: ${expiresIn === 'Permanent' ? 'Never' : `${expiresIn} minutes`}
                </div>
                <button class="effect-remove-btn" onclick="deactivateEffect(${effect.id})">
                    <i class="fas fa-times"></i> Remove Effect
                </button>
            </div>
        `;
    }).join('');
}

// Load cheat history
async function loadCheatHistory() {
    try {
        const { data: logs, error } = await supabase
            .from('cheat_logs')
            .select(`
                *,
                cheat:cheat_id (name, code),
                activator:activated_by (username),
                target:target_user_id (username)
            `)
            .order('activated_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        cheatLogs = logs || [];
        displayCheatHistory();

    } catch (error) {
        console.error('Error loading cheat history:', error);
    }
}

// Display cheat history
function displayCheatHistory() {
    if (!elements.cheatHistory) return;

    if (cheatLogs.length === 0) {
        elements.cheatHistory.innerHTML = '<p class="no-history">No cheat history</p>';
        return;
    }

    elements.cheatHistory.innerHTML = cheatLogs.map(log => `
        <tr>
            <td>${Utils.timeAgo(log.activated_at)}</td>
            <td><span class="cheat-badge">${log.cheat?.code || 'Unknown'}</span></td>
            <td>${log.cheat?.name || 'Unknown'}</td>
            <td>${log.activator?.username || 'System'}</td>
            <td>${log.target?.username || 'Self'}</td>
            <td>
                <span class="status-badge ${log.is_active ? 'status-active' : 'status-expired'}">
                    ${log.is_active ? 'Active' : 'Expired'}
                </span>
            </td>
            <td>
                <button class="action-btn view" onclick="viewCheatLog(${log.id})">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Apply cheat code
async function applyCheatCode() {
    const code = elements.codeInput?.value.trim().toUpperCase();
    if (!code) {
        notifications.warning('Please enter a cheat code');
        return;
    }

    const targetUserId = elements.targetUser?.value || null;

    try {
        // Get cheat code
        const { data: cheat, error: cheatError } = await supabase
            .from('cheat_codes')
            .select('*')
            .eq('code', code)
            .single();

        if (cheatError || !cheat) {
            notifications.error('Invalid cheat code');
            return;
        }

        // Check if target is allowed
        if (targetUserId && !cheat.target_others) {
            notifications.error('This cheat code cannot be used on others');
            return;
        }

        if (!targetUserId && !cheat.target_self) {
            notifications.error('This cheat code cannot be used on self');
            return;
        }

        // Check uses remaining
        if (cheat.uses_remaining === 0) {
            notifications.error('Cheat code has no uses left');
            return;
        }

        // Apply effect
        const result = await applyEffect(cheat, targetUserId || currentUser.id);

        if (result.success) {
            // Log the usage
            await supabase
                .from('cheat_logs')
                .insert([{
                    cheat_id: cheat.id,
                    activated_by: currentUser.id,
                    target_user_id: targetUserId || currentUser.id,
                    effect_data: result.data,
                    expires_at: result.expires_at,
                    activated_at: new Date().toISOString(),
                    is_active: true
                }]);

            // Update uses remaining
            if (cheat.uses_remaining > 0) {
                await supabase
                    .from('cheat_codes')
                    .update({ uses_remaining: cheat.uses_remaining - 1 })
                    .eq('id', cheat.id);
            }

            // Track activity
            await supabase
                .from('user_activities')
                .insert([{
                    user_id: currentUser.id,
                    activity_type: 'cheat_used',
                    activity_data: { 
                        code: cheat.code, 
                        target: targetUserId || 'self',
                        effect: cheat.effect_type
                    }
                }]);

            notifications.success(`Cheat activated: ${cheat.name}`);
            
            // Refresh data
            elements.codeInput.value = '';
            loadActiveEffects();
            loadCheatHistory();
            loadCheatCodes();
        }

    } catch (error) {
        console.error('Error applying cheat:', error);
        notifications.error('Failed to apply cheat code');
    }
}

// Apply effect based on cheat type
async function applyEffect(cheat, targetUserId) {
    const result = { success: false, data: null, expires_at: null };

    if (cheat.duration) {
        result.expires_at = new Date(Date.now() + cheat.duration * 60000).toISOString();
    }

    switch(cheat.effect_type) {
        case 'xp':
            await supabase.rpc('add_xp', { 
                p_user_id: targetUserId, 
                p_amount: cheat.effect_value || 1000000 
            });
            result.success = true;
            result.data = { xp_added: cheat.effect_value || 1000000 };
            break;

        case 'followers':
            await supabase
                .from('profiles')
                .update({ followers_count: supabase.raw(`followers_count + ${cheat.effect_value || 10000}`) })
                .eq('id', targetUserId);
            result.success = true;
            result.data = { followers_added: cheat.effect_value || 10000 };
            break;

        case 'streak':
            await supabase
                .from('profiles')
                .update({ streak: cheat.effect_value || 100 })
                .eq('id', targetUserId);
            result.success = true;
            result.data = { streak_set: cheat.effect_value || 100 };
            break;

        case 'level':
            await supabase
                .from('profiles')
                .update({ level: cheat.effect_value || 100 })
                .eq('id', targetUserId);
            result.success = true;
            result.data = { level_set: cheat.effect_value || 100 };
            break;

        case 'glow_title':
            await supabase
                .from('glowing_titles')
                .insert([{
                    user_id: targetUserId,
                    title_text: cheat.effect_data?.title || '✨ Glowing Legend ✨',
                    glow_color: cheat.effect_data?.color || 'gold',
                    glow_intensity: cheat.effect_data?.intensity || 10,
                    animation_speed: cheat.effect_data?.animation || 'medium',
                    created_by: currentUser.id,
                    expires_at: result.expires_at
                }]);
            result.success = true;
            result.data = cheat.effect_data;
            break;

        case 'frame':
            await supabase
                .from('profiles')
                .update({ avatar_frame: cheat.effect_data?.frame || 'day100' })
                .eq('id', targetUserId);
            result.success = true;
            result.data = { frame: cheat.effect_data?.frame };
            break;

        case 'frame_all':
            // Unlock all frames logic here
            result.success = true;
            result.data = { frames: 'all' };
            break;

        case 'badges':
            for (const badge of cheat.effect_data?.badges || []) {
                await supabase
                    .from('user_badges')
                    .insert([{
                        user_id: targetUserId,
                        badge_id: badge,
                        is_cheat: true
                    }]);
            }
            result.success = true;
            result.data = { badges: cheat.effect_data?.badges };
            break;

        case 'custom_stats':
            const stats = cheat.effect_data || {};
            await supabase
                .from('profiles')
                .update({
                    chapters_read: stats.chapters_read,
                    manga_finished: stats.manga_finished,
                    reading_time: stats.reading_time,
                    comments_count: stats.comments
                })
                .eq('id', targetUserId);
            result.success = true;
            result.data = stats;
            break;

        case 'visual':
            // Store visual effect preference
            await supabase
                .from('profiles')
                .update({ 
                    cheat_effects: supabase.raw(`cheat_effects || '{"${cheat.code}": ${JSON.stringify(cheat.effect_data)}}'::jsonb`)
                })
                .eq('id', targetUserId);
            result.success = true;
            result.data = cheat.effect_data;
            break;

        default:
            result.success = true;
            result.data = { message: 'Effect applied' };
    }

    return result;
}

// Use cheat code (called from cards)
window.useCheatCode = function(code) {
    if (elements.codeInput) {
        elements.codeInput.value = code;
    }
    applyCheatCode();
};

// Deactivate effect
window.deactivateEffect = async function(logId) {
    if (!confirm('Deactivate this effect?')) return;

    try {
        await supabase
            .from('cheat_logs')
            .update({ is_active: false })
            .eq('id', logId);

        notifications.success('Effect deactivated');
        loadActiveEffects();

    } catch (error) {
        console.error('Error deactivating effect:', error);
        notifications.error('Failed to deactivate effect');
    }
};

// Reset all cheat effects
async function resetCheatEffects() {
    if (!confirm('This will reset ALL active cheat effects for ALL users. Continue?')) return;

    try {
        await supabase
            .from('cheat_logs')
            .update({ is_active: false })
            .eq('is_active', true);

        await supabase
            .from('profiles')
            .update({ 
                cheat_effects: '[]'::jsonb,
                cheat_xp_multiplier: 1.0,
                cheat_glow_effect: '',
                cheat_title_color: '',
                cheat_badge: ''
            })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        notifications.success('All cheat effects reset');
        loadActiveEffects();

    } catch (error) {
        console.error('Error resetting effects:', error);
        notifications.error('Failed to reset effects');
    }
}

// Reset specific user
async function resetUser() {
    const userId = elements.targetUser?.value;
    if (!userId) {
        notifications.warning('Please select a user');
        return;
    }

    if (!confirm('Reset this user\'s profile to default?')) return;

    try {
        await supabase
            .from('cheat_logs')
            .update({ is_active: false })
            .eq('target_user_id', userId);

        await supabase
            .from('profiles')
            .update({ 
                cheat_effects: '[]'::jsonb,
                cheat_xp_multiplier: 1.0,
                cheat_glow_effect: '',
                cheat_title_color: '',
                cheat_badge: ''
            })
            .eq('id', userId);

        notifications.success('User reset successfully');

    } catch (error) {
        console.error('Error resetting user:', error);
        notifications.error('Failed to reset user');
    }
}

// Apply custom stat
async function applyCustomStat(e) {
    e.preventDefault();

    const userId = elements.targetUser?.value;
    const statName = elements.statName?.value;
    const statValue = parseInt(elements.statValue?.value);

    if (!userId || !statName || !statValue) {
        notifications.warning('Please fill all fields');
        return;
    }

    try {
        await supabase
            .from('admin_custom_stats')
            .upsert([{
                user_id: userId,
                stat_name: statName,
                stat_value: statValue,
                created_by: currentUser.id,
                created_at: new Date().toISOString()
            }]);

        // Update profile
        await supabase
            .from('profiles')
            .update({ [statName]: statValue })
            .eq('id', userId);

        notifications.success(`Stat ${statName} updated to ${statValue}`);
        elements.statName.value = '';
        elements.statValue.value = '';

    } catch (error) {
        console.error('Error applying custom stat:', error);
        notifications.error('Failed to apply stat');
    }
}

// Apply glowing title
async function applyGlowTitle() {
    const userId = elements.targetUser?.value || currentUser.id;
    const title = elements.glowTitle?.value.trim();
    const color = elements.glowColor?.value;
    const intensity = parseInt(elements.glowIntensity?.value);

    if (!title) {
        notifications.warning('Please enter a title');
        return;
    }

    try {
        await supabase
            .from('glowing_titles')
            .insert([{
                user_id: userId,
                title_text: title,
                glow_color: color,
                glow_intensity: intensity,
                created_by: currentUser.id,
                created_at: new Date().toISOString()
            }]);

        await supabase
            .from('profiles')
            .update({ 
                glow_title: title,
                cheat_glow_effect: color,
                cheat_title_color: color
            })
            .eq('id', userId);

        notifications.success('Glowing title applied');
        elements.glowTitle.value = '';

    } catch (error) {
        console.error('Error applying glow title:', error);
        notifications.error('Failed to apply glow title');
    }
}

// View cheat log
window.viewCheatLog = function(logId) {
    const log = cheatLogs.find(l => l.id === logId);
    if (!log) return;

    alert(JSON.stringify(log, null, 2));
}

// Create new cheat code (admin only)
window.createCheatCode = async function() {
    const code = prompt('Enter cheat code:');
    if (!code) return;

    const name = prompt('Enter cheat name:');
    if (!name) return;

    const description = prompt('Enter description:');
    if (!description) return;

    const effectType = prompt('Enter effect type (xp, followers, streak, glow_title, frame, visual):');
    if (!effectType) return;

    try {
        const { error } = await supabase
            .from('cheat_codes')
            .insert([{
                code: code.toUpperCase(),
                name,
                description,
                effect_type: effectType,
                requires_admin: true,
                created_by: currentUser.id,
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;

        notifications.success('Cheat code created');
        loadCheatCodes();

    } catch (error) {
        console.error('Error creating cheat code:', error);
        notifications.error('Failed to create cheat code');
    }
};

// Delete cheat code
window.deleteCheatCode = async function(code) {
    if (!confirm(`Delete cheat code ${code}?`)) return;

    try {
        const { error } = await supabase
            .from('cheat_codes')
            .delete()
            .eq('code', code);

        if (error) throw error;

        notifications.success('Cheat code deleted');
        loadCheatCodes();

    } catch (error) {
        console.error('Error deleting cheat code:', error);
        notifications.error('Failed to delete cheat code');
    }
};