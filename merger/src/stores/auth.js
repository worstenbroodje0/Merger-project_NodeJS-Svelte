import { writable } from 'svelte/store';

function createAuthStore() {
    const { subscribe, set, update } = writable({
        user: null,
        token: null,
        isAuthenticated: false
    });

    // Initialize from localStorage
    function initialize() {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token');
            const user = localStorage.getItem('user');
            
            if (token && user) {
                try {
                    const parsedUser = JSON.parse(user);
                    set({
                        user: parsedUser,
                        token: token,
                        isAuthenticated: true
                    });
                } catch (error) {
                    console.error('Failed to parse user from localStorage:', error);
                    logout();
                }
            }
        }
    }

    function login(token, user) {
        if (typeof window !== 'undefined') {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
        }
        set({
            user,
            token,
            isAuthenticated: true
        });
    }

    function logout() {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
        set({
            user: null,
            token: null,
            isAuthenticated: false
        });
    }

    return {
        subscribe,
        initialize,
        login,
        logout,
        set
    };
}

export const auth = createAuthStore();
