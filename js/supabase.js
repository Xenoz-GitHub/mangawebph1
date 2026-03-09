// js/supabase.js - No imports
// Supabase is loaded via CDN, so it's available globally

const supabase = window.supabase.createClient(
    window.CONFIG.SUPABASE.URL,
    window.CONFIG.SUPABASE.ANON_KEY
);

let currentUser = null;
let authListeners = [];

// Get current session
(async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user || null;
    } catch (error) {
        console.error('Error getting session:', error);
    }
})();

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    authListeners.forEach(listener => listener(currentUser));
});

// Make functions globally available
window.onAuthChange = function(callback) {
    authListeners.push(callback);
    callback(currentUser);
    return () => {
        authListeners = authListeners.filter(cb => cb !== callback);
    };
};

window.getCurrentUser = function() {
    return currentUser;
};

window.supabase = supabase;