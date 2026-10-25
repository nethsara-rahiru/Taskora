const AiSettings = {
  state: null,
  async init() {
    try { this.render(await API.get('/ai/settings')); }
    catch (error) { document.getElementById('groqKeyStatus').textContent = error.message; }
    const message = document.getElementById('groqSettingsMessage');
    document.getElementById('groqSettingsForm').addEventListener('submit', async event => {
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
    document.getElementById('testGroqBtn').addEventListener('click', async event => {
      const button = event.currentTarget; button.disabled = true; message.textContent = 'Testing the saved key…';
      try { message.textContent = (await API.post('/ai/test', {})).message; }
      catch (error) { message.textContent = error.message; }
      finally { button.disabled = false; }
    });
    document.getElementById('removeGroqBtn').addEventListener('click', async event => {
      const button = event.currentTarget; button.disabled = true;
      try { this.render(await API.delete('/ai/settings/key')); document.getElementById('groqApiKey').value = ''; message.textContent = 'Key removed. AI is disabled.'; }
      catch (error) { message.textContent = error.message; }
      finally { button.disabled = !this.state?.configured; }
    });
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
