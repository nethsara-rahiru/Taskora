const AiMemory = {
  initialized: false, busy: false, editing: null, data: null,
  async init() {
    if (this.initialized) return; this.initialized = true;
    this.form = document.getElementById('aiMemoryForm'); this.list = document.getElementById('aiMemoryList'); this.status = document.getElementById('aiMemoryStatus');
    this.content = document.getElementById('aiMemoryContent'); this.category = document.getElementById('aiMemoryCategory');
    this.save = document.getElementById('aiMemorySave'); this.cancel = document.getElementById('aiMemoryCancel'); this.toggle = document.getElementById('aiMemoryAutoLearn');
    LoadingUI.bindForm(this.form, () => this.persist(), { manageDisabled: false });
    LoadingUI.bindAction(document.getElementById('aiMemoryReload'), () => this.load());
    this.cancel.addEventListener('click', () => this.reset());
    this.toggle.addEventListener('change', () => LoadingUI.run(this.toggle, () => this.configure()).catch(error => LoadingUI.report(error)));
    await this.load();
  },
  element(tag, className, text) { const item = document.createElement(tag); item.className = className; if (text !== undefined) item.textContent = text; return item; },
  controls() {
    this.save.disabled = this.busy || !this.data || (!this.editing && this.data.memories.length >= this.data.limit);
    this.toggle.disabled = this.busy || !this.data;
    this.content.disabled = this.busy || !this.data; this.category.disabled = this.busy || !this.data;
    this.cancel.disabled = this.busy;
    for (const button of this.list.querySelectorAll('button')) button.disabled = this.busy;
  },
  accept(data) {
    this.data = data; this.toggle.checked = data.autoLearn;
    if (Auth.currentUser) { Auth.currentUser.aiMemoryRevision = data.revision; Auth.currentUser.aiMemory = data.memories; Auth.currentUser.aiMemoryAutoLearn = data.autoLearn; }
    document.getElementById('aiMemoryCount').textContent = `${data.memories.length}/${data.limit}`;
    this.list.replaceChildren();
    if (!data.memories.length) this.list.append(this.element('p', 'ai-help', 'No memories yet. Add something you would like AI to keep in mind.'));
    data.memories.forEach(memory => {
      const row = this.element('article', 'memory-item');
      row.append(this.element('p', 'memory-content', memory.content), this.element('p', 'ai-help', `${memory.category} · ${memory.source === 'ai' ? 'Added by AI' : 'Added by you'}`));
      const actions = this.element('div', 'ai-actions');
      const edit = this.element('button', 'btn btn-secondary btn-sm', 'Edit'); edit.type = 'button'; edit.setAttribute('aria-label', `Edit memory: ${memory.content}`);
      edit.addEventListener('click', () => {
        if (this.busy) return;
        this.editing = memory._id; this.content.value = memory.content; this.category.value = memory.category;
        this.save.textContent = 'Save memory'; this.cancel.hidden = false; this.controls(); this.content.focus();
      });
      const remove = this.element('button', 'btn btn-secondary btn-sm', 'Delete'); remove.type = 'button'; remove.setAttribute('aria-label', `Delete memory: ${memory.content}`);
      LoadingUI.bindAction(remove, () => this.remove(memory._id)); actions.append(edit, remove); row.append(actions); this.list.append(row);
    });
    this.controls();
  },
  reset() {
    this.editing = null; this.content.value = ''; this.category.value = 'preferences';
    this.save.textContent = 'Add memory'; this.cancel.hidden = true; this.controls();
  },
  async load() {
    if (this.busy) return;
    this.busy = true; this.controls(); this.status.classList.add('loading-text'); this.status.textContent = 'Loading memories…';
    try { this.accept(await API.get('/ai/memory')); this.status.textContent = 'Saved memories are used in new AI suggestions.'; }
    catch (error) { this.status.textContent = `${error.message} Use Refresh memories to retry.`; }
    finally { this.busy = false; this.status.classList.remove('loading-text'); this.controls(); }
  },
  async persist() {
    if (this.busy || !this.data) return;
    this.busy = true; this.controls(); this.status.textContent = 'Saving memory…';
    try {
      const input = { content: this.content.value.trim(), category: this.category.value };
      this.accept(this.editing ? await API.put(`/ai/memory/${this.editing}`, input) : await API.post('/ai/memory', input));
      this.reset(); this.status.textContent = 'Memory saved. New suggestions will use it.';
    } catch (error) { this.status.textContent = error.message || 'Could not save memory.'; }
    finally { this.busy = false; this.controls(); }
  },
  async remove(id) {
    if (this.busy) return;
    this.busy = true; this.controls(); this.status.textContent = 'Removing memory…';
    try { this.accept(await API.delete(`/ai/memory/${id}`)); if (this.editing === id) this.reset(); this.status.textContent = 'Memory deleted.'; }
    catch (error) { this.status.textContent = error.message || 'Could not delete memory.'; }
    finally { this.busy = false; this.controls(); }
  },
  async configure() {
    if (this.busy || !this.data) { if (this.data) this.toggle.checked = this.data.autoLearn; return; }
    const enabled = this.toggle.checked; this.busy = true; this.controls();
    try { this.accept(await API.put('/ai/memory/settings', { autoLearn: enabled })); this.status.textContent = enabled ? 'AI can add useful memories from your requests.' : 'Automatic learning is off. Your saved memories still personalize suggestions.'; }
    catch (error) { this.toggle.checked = this.data.autoLearn; this.status.textContent = error.message; }
    finally { this.busy = false; this.controls(); }
  }
};
window.AiMemory = AiMemory;
