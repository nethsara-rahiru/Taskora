const Auth = {
  currentUser: null,

  checking: null,
  async getCurrentUser(options = {}) {
    if (!options.fresh && this.currentUser) return this.currentUser;
    if (this.checking) return this.checking;
    this.checking = (async () => {
      try {
        const data = await API.get('/auth/me');
        StorageManager.bindUser(data.user._id);
        this.currentUser = data.user; StorageManager.save('user', data.user);
        return this.currentUser;
      } catch (error) {
        if (error.status !== 401 && error.status !== 403) {
          const saved = StorageManager.get('user');
          if (saved && String(saved._id) === StorageManager.owner) { this.currentUser = saved; return saved; }
        }
        this.currentUser = null; StorageManager.signOut(); return null;
      } finally { this.checking = null; }
    })();
    return this.checking;
  },
  expire() {
    this.currentUser = null; StorageManager.signOut();
    if (!location.pathname.includes('login.html')) location.replace('/login.html');
  },

  async login(email, password) {
    const data = await API.post('/auth/login', { email, password });
    StorageManager.bindUser(data.user._id);
    this.currentUser = data.user; StorageManager.save('user', data.user);
    return data.user;
  },

  async register(name, email, password) {
    const data = await API.post('/auth/register', { name, email, password });
    StorageManager.bindUser(data.user._id);
    this.currentUser = data.user; StorageManager.save('user', data.user);
    return data.user;
  },

  async logout() {
    await API.post('/auth/logout');
    this.currentUser = null; StorageManager.signOut();
    window.location.href = '/login.html';
  },

  requireAuth() {
    return this.getCurrentUser({ fresh: true }).then(user => {
      if (!user && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html') && window.location.pathname !== '/') {
        window.location.href = '/login.html';
      }
      return user;
    });
  }
};

window.Auth = Auth;

window.addEventListener('storage', event => {
  if (event.key === 'taskora_cache_owner' && Auth.currentUser && event.newValue !== String(Auth.currentUser._id)) {
    Auth.currentUser = null; location.replace('/login.html');
  }
});
