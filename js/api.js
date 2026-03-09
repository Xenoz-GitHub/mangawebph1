// js/api.js - No imports, use global objects
window.API = {
    supabase: window.supabase,

    // ==================== AUTHENTICATION ====================

    signUp: async function(email, password, userData) {
        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: userData,
                    emailRedirectTo: `${window.location.origin}/pages/verify-email.html`
                }
            });

            if (error) throw error;

            if (data.user) {
                const { error: profileError } = await this.supabase
                    .from('profiles')
                    .insert([{
                        id: data.user.id,
                        username: userData.username,
                        email: email,
                        avatar_url: '/images/default-avatar.png',
                        created_at: new Date().toISOString()
                    }]);

                if (profileError) throw profileError;
            }

            window.Notifications.success('Account created! Please check your email.');
            return { success: true, data };
        } catch (error) {
            console.error('Sign up error:', error);
            window.Notifications.error(error.message);
            return { success: false, error: error.message };
        }
    },

    signIn: async function(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            if (!data.user.email_confirmed_at) {
                window.Notifications.warning('Please verify your email first.');
                return { success: false, error: 'Email not verified' };
            }

            await this.supabase
                .from('profiles')
                .update({ last_login: new Date().toISOString() })
                .eq('id', data.user.id);

            window.Notifications.success('Signed in successfully!');
            return { success: true, data };
        } catch (error) {
            console.error('Sign in error:', error);
            window.Notifications.error(error.message);
            return { success: false, error: error.message };
        }
    },

    signOut: async function() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            window.Notifications.success('Signed out');
            window.location.href = '/';
            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            window.Notifications.error(error.message);
            return { success: false, error: error.message };
        }
    },

    // Add more methods as needed...
};