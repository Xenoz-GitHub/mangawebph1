// Collections page - PRODUCTION READY
import { supabase, getCurrentUser, onAuthChange } from '../supabase.js';
import notifications from '../notifications.js';
import { Utils } from '../utils.js';

// DOM Elements
const elements = {
    totalCollections: document.getElementById('totalCollections'),
    publicCollections: document.getElementById('publicCollections'),
    totalItems: document.getElementById('totalItems'),
    followers: document.getElementById('followers'),
    collectionsGrid: document.getElementById('collectionsGrid'),
    createModal: document.getElementById('createModal'),
    collectionName: document.getElementById('collectionName'),
    collectionDesc: document.getElementById('collectionDesc'),
    collectionVisibility: document.getElementById('collectionVisibility'),
    iconSelector: document.getElementById('iconSelector'),
    createBtn: document.querySelector('#createModal .btn-primary')
};

// State
let currentUser = null;
let collections = [];
let selectedIcon = 'fa-heart';
let collectionItems = new Map(); // collection_id -> items count

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    onAuthChange(async (user) => {
        currentUser = user;
        if (!user) {
            window.location.href = 'signin.html';
            return;
        }
        await loadCollections();
    });

    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Icon selection
    if (elements.iconSelector) {
        elements.iconSelector.addEventListener('click', (e) => {
            const iconOption = e.target.closest('.icon-option');
            if (!iconOption) return;

            document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
            iconOption.classList.add('selected');
            selectedIcon = iconOption.dataset.icon;
        });
    }

    // Create button
    if (elements.createBtn) {
        elements.createBtn.addEventListener('click', createCollection);
    }

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === elements.createModal) {
            closeCreateModal();
        }
    });
}

// Load collections
async function loadCollections() {
    if (!currentUser) return;

    showLoading();

    try {
        // Load user collections
        const { data: cols, error: colsError } = await supabase
            .from('user_collections')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (colsError) throw colsError;

        collections = cols || [];

        // Load item counts for each collection
        await loadCollectionItems();

        // Update UI
        displayCollections();
        updateStats();

    } catch (error) {
        console.error('Error loading collections:', error);
        notifications.error('Failed to load collections');
        showError();
    }
}

// Load collection items count
async function loadCollectionItems() {
    if (collections.length === 0) return;

    try {
        const collectionIds = collections.map(c => c.id);

        const { data: items, error } = await supabase
            .from('collection_items')
            .select('collection_id, manga_id')
            .in('collection_id', collectionIds);

        if (error) throw error;

        // Count items per collection
        collectionItems.clear();
        items?.forEach(item => {
            const count = collectionItems.get(item.collection_id) || 0;
            collectionItems.set(item.collection_id, count + 1);
        });

    } catch (error) {
        console.error('Error loading collection items:', error);
    }
}

// Display collections
function displayCollections() {
    if (!elements.collectionsGrid) return;

    if (collections.length === 0) {
        elements.collectionsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>No Collections Yet</h3>
                <p>Create your first collection to organize your manga</p>
                <button class="btn-primary" onclick="openCreateModal()">
                    <i class="fas fa-plus"></i> Create Collection
                </button>
            </div>
        `;
        return;
    }

    elements.collectionsGrid.innerHTML = collections.map(collection => {
        const itemCount = collectionItems.get(collection.id) || 0;
        const previewItems = collection.preview_images || [];

        return `
            <div class="collection-card" data-collection-id="${collection.id}">
                <div class="collection-cover">
                    <div class="collection-icon">
                        <i class="fas ${collection.icon || 'fa-folder'}"></i>
                    </div>
                </div>
                <div class="collection-info">
                    <div class="collection-header">
                        <h3 class="collection-name">${Utils.escapeHtml(collection.name)}</h3>
                        <span class="collection-badge badge-${collection.is_public ? 'public' : 'private'}">
                            ${collection.is_public ? 'Public' : 'Private'}
                        </span>
                    </div>
                    <p class="collection-description">${Utils.escapeHtml(collection.description || '')}</p>
                    <div class="collection-meta">
                        <span><i class="fas fa-book"></i> ${itemCount} items</span>
                        <span><i class="fas fa-heart"></i> ${collection.followers || 0}</span>
                    </div>
                    <div class="collection-preview">
                        ${generatePreview(previewItems, itemCount)}
                    </div>
                    <div class="collection-actions">
                        <button class="collection-action-btn" onclick="viewCollection(${collection.id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="collection-action-btn" onclick="editCollection(${collection.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="collection-action-btn delete" onclick="deleteCollection(${collection.id}, event)">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Generate preview HTML
function generatePreview(images, count) {
    if (count === 0) {
        return '<div class="preview-item" style="background: rgba(108,92,231,0.1); display: flex; align-items: center; justify-content: center;"><i class="fas fa-book-open" style="color: var(--primary-color);"></i></div>';
    }

    const previewCount = Math.min(images.length, 3);
    let html = '';

    for (let i = 0; i < previewCount; i++) {
        html += `<div class="preview-item"><img src="${images[i] || '../images/no-cover.jpg'}" alt="Preview"></div>`;
    }

    if (count > 3) {
        html += `<div class="preview-more">+${count - 3}</div>`;
    }

    return html;
}

// Update statistics
function updateStats() {
    if (!elements.totalCollections) return;

    const total = collections.length;
    const publicCount = collections.filter(c => c.is_public).length;
    const totalItems = Array.from(collectionItems.values()).reduce((sum, count) => sum + count, 0);
    const totalFollowers = collections.reduce((sum, c) => sum + (c.followers || 0), 0);

    elements.totalCollections.textContent = total;
    elements.publicCollections.textContent = publicCount;
    elements.totalItems.textContent = totalItems;
    elements.followers.textContent = totalFollowers;
}

// Open create modal
window.openCreateModal = function() {
    if (elements.createModal) {
        // Reset form
        if (elements.collectionName) elements.collectionName.value = '';
        if (elements.collectionDesc) elements.collectionDesc.value = '';
        if (elements.collectionVisibility) elements.collectionVisibility.value = 'public';
        
        document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
        document.querySelector('.icon-option[data-icon="fa-heart"]')?.classList.add('selected');
        selectedIcon = 'fa-heart';

        elements.createModal.classList.add('active');
    }
};

// Close create modal
window.closeCreateModal = function() {
    if (elements.createModal) {
        elements.createModal.classList.remove('active');
    }
};

// Create collection
window.createCollection = async function() {
    if (!currentUser) return;

    const name = elements.collectionName?.value.trim();
    if (!name) {
        notifications.warning('Please enter a collection name');
        return;
    }

    const description = elements.collectionDesc?.value.trim() || '';
    const isPublic = elements.collectionVisibility?.value === 'public';

    try {
        const { data, error } = await supabase
            .from('user_collections')
            .insert([{
                user_id: currentUser.id,
                name: name,
                description: description,
                icon: selectedIcon,
                is_public: isPublic,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        // Add to local state
        collections.unshift(data);
        displayCollections();
        updateStats();

        notifications.success('Collection created successfully');
        closeCreateModal();

    } catch (error) {
        console.error('Error creating collection:', error);
        notifications.error('Failed to create collection');
    }
};

// View collection
window.viewCollection = function(collectionId) {
    window.location.href = `collection-details.html?id=${collectionId}`;
};

// Edit collection
window.editCollection = async function(collectionId) {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;

    // Populate form
    if (elements.collectionName) elements.collectionName.value = collection.name;
    if (elements.collectionDesc) elements.collectionDesc.value = collection.description || '';
    if (elements.collectionVisibility) elements.collectionVisibility.value = collection.is_public ? 'public' : 'private';

    // Select icon
    document.querySelectorAll('.icon-option').forEach(opt => {
        if (opt.dataset.icon === collection.icon) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
    selectedIcon = collection.icon;

    // Change modal title and button
    const modalTitle = document.querySelector('#createModal h2');
    const createBtn = document.querySelector('#createModal .btn-primary');
    
    if (modalTitle) modalTitle.textContent = 'Edit Collection';
    if (createBtn) {
        createBtn.textContent = 'Update';
        createBtn.onclick = () => updateCollection(collectionId);
    }

    openCreateModal();
};

// Update collection
window.updateCollection = async function(collectionId) {
    if (!currentUser) return;

    const name = elements.collectionName?.value.trim();
    if (!name) {
        notifications.warning('Please enter a collection name');
        return;
    }

    const description = elements.collectionDesc?.value.trim() || '';
    const isPublic = elements.collectionVisibility?.value === 'public';

    try {
        const { error } = await supabase
            .from('user_collections')
            .update({
                name: name,
                description: description,
                icon: selectedIcon,
                is_public: isPublic,
                updated_at: new Date().toISOString()
            })
            .eq('id', collectionId)
            .eq('user_id', currentUser.id);

        if (error) throw error;

        // Update local state
        const index = collections.findIndex(c => c.id === collectionId);
        if (index !== -1) {
            collections[index] = {
                ...collections[index],
                name,
                description,
                icon: selectedIcon,
                is_public: isPublic
            };
        }

        displayCollections();
        notifications.success('Collection updated successfully');

        // Reset modal
        resetCreateModal();
        closeCreateModal();

    } catch (error) {
        console.error('Error updating collection:', error);
        notifications.error('Failed to update collection');
    }
};

// Delete collection
window.deleteCollection = async function(collectionId, event) {
    event.stopPropagation();

    if (!confirm('Are you sure you want to delete this collection? This action cannot be undone.')) return;

    try {
        const { error } = await supabase
            .from('user_collections')
            .delete()
            .eq('id', collectionId)
            .eq('user_id', currentUser.id);

        if (error) throw error;

        // Remove from local state
        collections = collections.filter(c => c.id !== collectionId);
        collectionItems.delete(collectionId);

        displayCollections();
        updateStats();

        notifications.success('Collection deleted');

    } catch (error) {
        console.error('Error deleting collection:', error);
        notifications.error('Failed to delete collection');
    }
};

// Reset create modal
function resetCreateModal() {
    const modalTitle = document.querySelector('#createModal h2');
    const createBtn = document.querySelector('#createModal .btn-primary');
    
    if (modalTitle) modalTitle.textContent = 'Create New Collection';
    if (createBtn) {
        createBtn.textContent = 'Create';
        createBtn.onclick = createCollection;
    }
}

// Show loading
function showLoading() {
    if (!elements.collectionsGrid) return;

    elements.collectionsGrid.innerHTML = `
        <div class="loading-skeleton">
            ${Array(3).fill('<div class="skeleton-card"></div>').join('')}
        </div>
    `;
}

// Show error
function showError() {
    if (!elements.collectionsGrid) return;

    elements.collectionsGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Error Loading Collections</h3>
            <p>Please try refreshing the page</p>
            <button class="btn-primary" onclick="location.reload()">Refresh</button>
        </div>
    `;
}