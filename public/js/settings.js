async function loadCurrentPageData() {
  const user = await Auth.getCurrentUser();
  if (!user) return;

  // Profile Form
  document.getElementById('settingsName').value = user.name || '';
  document.getElementById('settingsEmail').value = user.email || '';

  // WhatsApp Form
  document.getElementById('settingsPhone').value = user.whatsapp?.phoneNumber || '';
  document.getElementById('settingsWaEnabled').checked = !!user.whatsapp?.enabled;

  // Theme
  const currentTheme = localStorage.getItem('taskora_theme') || 'system';
  document.getElementById('settingsTheme').value = currentTheme;
}

function setupFormListeners() {
  // Update Profile
  document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const name = document.getElementById('settingsName').value.trim();
      const email = document.getElementById('settingsEmail').value.trim();
      await API.put('/user', { name, email });
      Notifications.show('Profile updated successfully!', 'success');
      Auth.getCurrentUser().then(u => App.initHeaderUser(u));
    } catch (err) {
      Notifications.show(err.message, 'error');
    }
  });

  // Update WhatsApp
  document.getElementById('whatsappForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const phoneNumber = document.getElementById('settingsPhone').value.trim();
      const enabled = document.getElementById('settingsWaEnabled').checked;
      await API.put('/whatsapp/settings', { phoneNumber, enabled });
      Notifications.show('WhatsApp preferences saved!', 'success');
    } catch (err) {
      Notifications.show(err.message, 'error');
    }
  });

  // Test WhatsApp Message
  document.getElementById('testWaBtn')?.addEventListener('click', async () => {
    try {
      const phoneNumber = document.getElementById('settingsPhone').value.trim();
      const res = await API.post('/whatsapp/test', { phoneNumber });
      Notifications.show('Test message triggered! (Mock logging enabled)', 'success');
    } catch (err) {
      Notifications.show(err.message, 'error');
    }
  });

  // Theme Change
  document.getElementById('settingsTheme')?.addEventListener('change', (e) => {
    App.setTheme(e.target.value);
    Notifications.show(`Theme updated to ${e.target.value}`, 'info');
  });

  // Change Password
  document.getElementById('passwordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPass').value;
    const newPassword = document.getElementById('newPass').value;
    try {
      await API.put('/user/password', { currentPassword, newPassword });
      Notifications.show('Password changed successfully!', 'success');
      document.getElementById('passwordForm').reset();
    } catch (err) {
      Notifications.show(err.message, 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupFormListeners();
  loadCurrentPageData();
});

window.loadCurrentPageData = loadCurrentPageData;
