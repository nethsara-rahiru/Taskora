const AiSettings = {
  state: null,
  async init() {
    const saveButton = document.getElementById('saveGroqBtn'); saveButton.disabled = true;
    const keyStatus = document.getElementById('groqKeyStatus'); keyStatus.classList.add('loading-text');
    try { this.render(await API.get('/ai/settings')); }
    catch (error) { document.getElementById('groqKeyStatus').textContent = error.message; }
    finally { saveButton.disabled = false; keyStatus.classList.remove('loading-text'); }
    const message = document.getElementById('groqSettingsMessage');
    LoadingUI.bindForm(document.getElementById('groqSettingsForm'), async event => {
      event.preventDefault();
      const button = document.getElementById('saveGroqBtn'); button.disabled = true;
      message.textContent = 'Saving…';
      try {
        const data = { enabled: document.getElementById('groqEnabled').checked, model: document.getElementById('groqModel').value,
          timezone: document.getElementById('groqTimezone').value.trim(), workdayStart: document.getElementById('aiWorkStart').value,
          workdayEnd: document.getElementById('aiWorkEnd').value, defaultDuration: Number(document.getElementById('aiTaskDuration').value) };
        const input = document.getElementById('groqApiKey');
        if (input.value.trim()) data.apiKey = input.value.trim();
        const saved = await API.put('/ai/settings', data);
        input.value = ''; this.render(saved); message.textContent = 'AI settings saved. Your key will not be shown again.';
      } catch (error) { message.textContent = error.message; }
      finally { button.disabled = false; }
    });
    LoadingUI.bindAction(document.getElementById('testGroqBtn'), async event => {
      const button = event.currentTarget; button.disabled = true; message.textContent = 'Testing the saved key…';
      try { message.textContent = (await API.post('/ai/test', {})).message; }
      catch (error) { message.textContent = error.message; }
      finally { button.disabled = false; }
    }, { manageDisabled: false });
    LoadingUI.bindAction(document.getElementById('removeGroqBtn'), async event => {
      const button = event.currentTarget; button.disabled = true;
      try { this.render(await API.delete('/ai/settings/key')); document.getElementById('groqApiKey').value = ''; message.textContent = 'Key removed. AI is disabled.'; }
      catch (error) { message.textContent = error.message; }
      finally { button.disabled = !this.state?.configured; }
    }, { manageDisabled: false });
  },
  render(data) {
    this.state = data;
    document.getElementById('groqKeyStatus').textContent = !data.encryptionReady
      ? 'The server needs AI_ENCRYPTION_KEY (a stable random secret of 32+ characters) before saving keys.'
      : data.configured ? 'A Groq API key is saved securely.' : 'No Groq API key saved yet.';
    document.getElementById('groqEnabled').checked = data.enabled;
    document.getElementById('groqModel').value = data.model;
    document.getElementById('groqTimezone').value = data.timezone;
    document.getElementById('aiWorkStart').value = data.workdayStart;
    document.getElementById('aiWorkEnd').value = data.workdayEnd;
    document.getElementById('aiTaskDuration').value = data.defaultDuration;
    document.getElementById('testGroqBtn').disabled = !data.configured;
    document.getElementById('removeGroqBtn').disabled = !data.configured;
  }
};
document.addEventListener('DOMContentLoaded', () => AiSettings.init());
