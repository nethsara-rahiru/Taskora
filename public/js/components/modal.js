const Modal = {
  overlay: null,

  init() {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'modal-overlay';
      this.overlay.innerHTML = `
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title" id="modalTitle">Modal Title</h3>
            <button class="btn-icon" id="modalCloseBtn">&times;</button>
          </div>
          <div class="modal-body" id="modalBody"></div>
        </div>
      `;
      document.body.appendChild(this.overlay);

      document.getElementById('modalCloseBtn').addEventListener('click', () => this.close());
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });
    }
  },

  open(title, contentHtml) {
    this.init();
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = contentHtml;
    this.overlay.classList.add('active');
  },

  close() {
    if (this.overlay) {
      this.overlay.classList.remove('active');
    }
  }
};

window.Modal = Modal;
