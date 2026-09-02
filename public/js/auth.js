const Auth = {
  currentUser: null,

  async getCurrentUser() {
    try {
      const data = await API.get('/auth/me');
      this.currentUser = data.user;
      return this.currentUser;
    } catch (error) {
      this.currentUser = null;
      return null;
    }
  },

  async login(email, password) {
    const data = await API.post('/auth/login', { email, password });
    this.currentUser = data.user;
    return data.user;
  },

  async register(name, email, password) {
    const data = await API.post('/auth/register', { name, email, password });
    this.currentUser = data.user;
    return data.user;
  },

  async logout() {
    await API.post('/auth/logout');
    this.currentUser = null;
    window.location.href = '/login.html';
  },

  requireAuth() {
    return this.getCurrentUser().then(user => {
      if (!user && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html') && window.location.pathname !== '/') {
        window.location.href = '/login.html';
      }
      return user;
    });
  }
};

window.Auth = Auth;
