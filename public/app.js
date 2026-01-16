/**
 * Fast Drive Monitor - Frontend Application
 */

class FastDriveApp {
  constructor() {
    this.ws = null;
    this.state = {
      registeredHeadsets: [],
      activeHeadsets: [],
      connectedDongles: [],
      availableColors: {}
    };

    this.serverInfo = null;
    this.apiUrl = window.location.origin;
    this.wsUrl = `ws://${window.location.host}/ws`;

    this.editingHeadsetId = null;
    this.deletingHeadsetId = null;

    this.init();
  }

  async init() {
    this.bindElements();
    this.bindEvents();
    this.startClock();
    await this.loadInitialState();
    this.connectWebSocket();
  }

  startClock() {
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 1000);
  }

  updateDateTime() {
    const now = new Date();

    // Horário
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;

    // Data
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    document.getElementById('date').textContent = `${day}/${month}/${year}`;

    // Uptime
    if (this.serverInfo && this.serverInfo.startedAt) {
      const uptimeMs = Date.now() - this.serverInfo.startedAt;
      document.getElementById('uptime').textContent = `Uptime: ${this.formatUptime(uptimeMs)}`;
    }
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  updateServerInfo(serverInfo) {
    this.serverInfo = serverInfo;

    // Hostname
    document.getElementById('hostname').textContent = serverInfo.hostname || '---';

    // IP
    document.getElementById('ip').textContent = serverInfo.ip || '---';

    // Versão
    document.getElementById('version').textContent = serverInfo.version ? `v${serverInfo.version}` : 'v---';
  }

  bindElements() {
    // Connection status
    this.connectionStatus = document.getElementById('connectionStatus');
    this.statusDot = this.connectionStatus.querySelector('.status-dot');
    this.statusText = this.connectionStatus.querySelector('.status-text');

    // Dongles
    this.donglesGrid = document.getElementById('donglesGrid');
    this.dongleCount = document.getElementById('dongleCount');
    this.noDongles = document.getElementById('noDongles');

    // Active headsets
    this.activeHeadsetsGrid = document.getElementById('activeHeadsetsGrid');
    this.activeCount = document.getElementById('activeCount');
    this.noActiveHeadsets = document.getElementById('noActiveHeadsets');

    // Registered headsets
    this.registeredHeadsetsList = document.getElementById('registeredHeadsetsList');
    this.noRegisteredHeadsets = document.getElementById('noRegisteredHeadsets');

    // Modal: Add/Edit
    this.headsetModal = document.getElementById('headsetModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.headsetForm = document.getElementById('headsetForm');
    this.headsetIdInput = document.getElementById('headsetId');
    this.headsetNameInput = document.getElementById('headsetName');
    this.headsetNumberInput = document.getElementById('headsetNumber');
    this.headsetColorInput = document.getElementById('headsetColor');
    this.colorPicker = document.getElementById('colorPicker');

    // Modal: Delete
    this.deleteModal = document.getElementById('deleteModal');
    this.deleteHeadsetName = document.getElementById('deleteHeadsetName');
  }

  bindEvents() {
    // Add headset button
    document.getElementById('addHeadsetBtn').addEventListener('click', () => this.openAddModal());

    // Modal close buttons
    document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
    document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
    this.headsetModal.querySelector('.modal-overlay').addEventListener('click', () => this.closeModal());

    // Delete modal
    document.getElementById('deleteModalClose').addEventListener('click', () => this.closeDeleteModal());
    document.getElementById('deleteCancelBtn').addEventListener('click', () => this.closeDeleteModal());
    document.getElementById('deleteConfirmBtn').addEventListener('click', () => this.confirmDelete());
    this.deleteModal.querySelector('.modal-overlay').addEventListener('click', () => this.closeDeleteModal());

    // Form submission
    this.headsetForm.addEventListener('submit', (e) => this.handleFormSubmit(e));

    // Color picker
    this.colorPicker.querySelectorAll('.color-option').forEach(btn => {
      btn.addEventListener('click', () => this.selectColor(btn.dataset.color));
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        this.closeDeleteModal();
      }
    });
  }

  async loadInitialState() {
    try {
      const response = await fetch(`${this.apiUrl}/api/state`);
      if (response.ok) {
        const data = await response.json();
        this.updateState(data);
      }
    } catch (error) {
      console.error('Erro ao carregar estado inicial:', error);
    }
  }

  connectWebSocket() {
    this.updateConnectionStatus('connecting');

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket conectado');
      this.updateConnectionStatus('connected');
    };

    this.ws.onclose = () => {
      console.log('WebSocket desconectado');
      this.updateConnectionStatus('disconnected');
      // Reconectar após 3 segundos
      setTimeout(() => this.connectWebSocket(), 3000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket erro:', error);
      this.updateConnectionStatus('disconnected');
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleWebSocketMessage(message);
    };
  }

  handleWebSocketMessage(message) {
    console.log('WS:', message.type, message.data);

    switch (message.type) {
      case 'init':
        this.updateState(message.data);
        if (message.serverInfo) {
          this.updateServerInfo(message.serverInfo);
        }
        break;

      case 'dongleConnected':
        this.addDongle(message.data);
        break;

      case 'dongleDisconnected':
        this.removeDongle(message.data.id);
        break;

      case 'headsetTurnedOn':
        this.addActiveHeadset(message.data);
        break;

      case 'headsetTurnedOff':
        this.removeActiveHeadset(message.data.id);
        break;

      case 'headsetStateUpdated':
        this.updateActiveHeadset(message.data);
        break;

      case 'headsetRegistered':
        this.addRegisteredHeadset(message.data);
        break;

      case 'headsetUpdated':
        this.updateRegisteredHeadset(message.data);
        break;

      case 'headsetRemoved':
        this.removeRegisteredHeadset(message.data.id);
        break;
    }
  }

  updateState(data) {
    this.state = { ...this.state, ...data };
    this.renderAll();
  }

  updateConnectionStatus(status) {
    this.statusDot.classList.remove('connected', 'disconnected');

    switch (status) {
      case 'connected':
        this.statusDot.classList.add('connected');
        this.statusText.textContent = 'Conectado';
        break;
      case 'disconnected':
        this.statusDot.classList.add('disconnected');
        this.statusText.textContent = 'Desconectado';
        break;
      default:
        this.statusText.textContent = 'Conectando...';
    }
  }

  // === Render Functions ===

  renderAll() {
    this.renderDongles();
    this.renderActiveHeadsets();
    this.renderRegisteredHeadsets();
  }

  renderDongles() {
    const dongles = this.state.connectedDongles || [];
    this.dongleCount.textContent = dongles.length;

    if (dongles.length === 0) {
      this.noDongles.classList.remove('hidden');
      // Remove dongle cards
      this.donglesGrid.querySelectorAll('.dongle-card').forEach(el => el.remove());
      return;
    }

    this.noDongles.classList.add('hidden');

    // Clear and re-render
    this.donglesGrid.querySelectorAll('.dongle-card').forEach(el => el.remove());

    dongles.forEach(dongle => {
      const card = this.createDongleCard(dongle);
      this.donglesGrid.appendChild(card);
    });
  }

  createDongleCard(dongle) {
    const card = document.createElement('div');
    card.className = 'dongle-card';
    card.dataset.id = dongle.id;

    card.innerHTML = `
      <div class="dongle-indicator"></div>
      <div class="dongle-info">
        <div class="dongle-name">${this.escapeHtml(dongle.name || 'Jabra Dongle')}</div>
        <div class="dongle-status">Conectado</div>
      </div>
    `;

    return card;
  }

  renderActiveHeadsets() {
    const headsets = this.state.activeHeadsets || [];
    this.activeCount.textContent = headsets.length;

    if (headsets.length === 0) {
      this.noActiveHeadsets.classList.remove('hidden');
      this.activeHeadsetsGrid.querySelectorAll('.headset-card').forEach(el => el.remove());
      return;
    }

    this.noActiveHeadsets.classList.add('hidden');

    // Clear and re-render
    this.activeHeadsetsGrid.querySelectorAll('.headset-card').forEach(el => el.remove());

    headsets.forEach(headset => {
      const card = this.createActiveHeadsetCard(headset);
      this.activeHeadsetsGrid.appendChild(card);
    });
  }

  createActiveHeadsetCard(headset) {
    const card = document.createElement('div');
    card.className = 'headset-card';
    card.dataset.id = headset.id;

    const color = this.state.availableColors[headset.color] || this.state.availableColors.blue;
    const colorHex = color?.hex || '#3B82F6';
    card.style.setProperty('--headset-color', colorHex);

    const batteryLevel = headset.batteryLevel ?? 0;
    const batteryClass = batteryLevel < 20 ? 'low' : batteryLevel < 50 ? 'medium' : 'high';
    const isLightColor = headset.color === 'white' || headset.color === 'yellow';

    card.innerHTML = `
      <div class="headset-header">
        <div class="headset-identity">
          <div class="headset-number ${isLightColor ? 'light' : ''}" style="background: ${colorHex}">
            ${headset.number || '-'}
          </div>
          <div>
            <div class="headset-name">${this.escapeHtml(headset.name)}</div>
            <div class="headset-model">${this.escapeHtml(headset.model || 'Jabra Engage 55')}</div>
          </div>
        </div>
        <div class="headset-status-icons">
          <div class="status-icon charging ${headset.isCharging ? 'active' : ''}" title="Carregando">&#9889;</div>
          <div class="status-icon call ${headset.isInCall ? 'active' : ''}" title="Em chamada">&#128222;</div>
          <div class="status-icon muted ${headset.isMuted ? 'active' : ''}" title="Mudo">&#128263;</div>
        </div>
      </div>
      <div class="battery-display">
        <div class="battery-bar">
          <div class="battery-fill ${batteryClass}" style="width: ${batteryLevel}%"></div>
        </div>
        <div class="battery-info">
          <span class="battery-percentage">${batteryLevel}%</span>
          <span>${headset.isCharging ? 'Carregando' : 'Em uso'}</span>
        </div>
      </div>
    `;

    return card;
  }

  renderRegisteredHeadsets() {
    const headsets = this.state.registeredHeadsets || [];

    if (headsets.length === 0) {
      this.noRegisteredHeadsets.classList.remove('hidden');
      this.registeredHeadsetsList.querySelectorAll('.headset-list-item').forEach(el => el.remove());
      return;
    }

    this.noRegisteredHeadsets.classList.add('hidden');

    // Clear and re-render
    this.registeredHeadsetsList.querySelectorAll('.headset-list-item').forEach(el => el.remove());

    // Sort by number
    const sorted = [...headsets].sort((a, b) => (a.number || 999) - (b.number || 999));

    sorted.forEach(headset => {
      const item = this.createRegisteredHeadsetItem(headset);
      this.registeredHeadsetsList.appendChild(item);
    });
  }

  createRegisteredHeadsetItem(headset) {
    const item = document.createElement('div');
    item.className = 'headset-list-item';
    item.dataset.id = headset.id;

    const color = this.state.availableColors[headset.color] || this.state.availableColors.blue;
    const colorHex = color?.hex || '#3B82F6';

    const isActive = this.state.activeHeadsets.some(h => h.id === headset.id);
    if (!isActive) {
      item.classList.add('inactive');
    }

    item.innerHTML = `
      <div class="item-color" style="--item-color: ${colorHex}"></div>
      <div class="item-number">${headset.number || '-'}</div>
      <div class="item-info">
        <div class="item-name">${this.escapeHtml(headset.name)}</div>
        <div class="item-status ${isActive ? 'online' : ''}">${isActive ? 'Online' : 'Offline'}</div>
      </div>
      <div class="item-actions">
        <button class="btn-icon" onclick="app.openEditModal('${headset.id}')" title="Editar">&#9998;</button>
        <button class="btn-icon" onclick="app.openDeleteModal('${headset.id}')" title="Remover">&#128465;</button>
      </div>
    `;

    return item;
  }

  // === State Update Functions ===

  addDongle(dongle) {
    const exists = this.state.connectedDongles.find(d => d.id === dongle.id);
    if (!exists) {
      this.state.connectedDongles.push(dongle);
      this.renderDongles();
    }
  }

  removeDongle(id) {
    this.state.connectedDongles = this.state.connectedDongles.filter(d => d.id !== id);
    this.renderDongles();
  }

  addActiveHeadset(headset) {
    const exists = this.state.activeHeadsets.find(h => h.id === headset.id);
    if (!exists) {
      this.state.activeHeadsets.push(headset);
    } else {
      Object.assign(exists, headset);
    }
    this.renderActiveHeadsets();
    this.renderRegisteredHeadsets(); // Update online status
  }

  removeActiveHeadset(id) {
    this.state.activeHeadsets = this.state.activeHeadsets.filter(h => h.id !== id);
    this.renderActiveHeadsets();
    this.renderRegisteredHeadsets(); // Update online status
  }

  updateActiveHeadset(headset) {
    const existing = this.state.activeHeadsets.find(h => h.id === headset.id);
    if (existing) {
      Object.assign(existing, headset);
      this.renderActiveHeadsets();
    }
  }

  addRegisteredHeadset(headset) {
    const exists = this.state.registeredHeadsets.find(h => h.id === headset.id);
    if (!exists) {
      this.state.registeredHeadsets.push(headset);
      this.renderRegisteredHeadsets();
    }
  }

  updateRegisteredHeadset(headset) {
    const index = this.state.registeredHeadsets.findIndex(h => h.id === headset.id);
    if (index !== -1) {
      this.state.registeredHeadsets[index] = headset;
      this.renderRegisteredHeadsets();
      this.renderActiveHeadsets(); // Update active card too
    }
  }

  removeRegisteredHeadset(id) {
    this.state.registeredHeadsets = this.state.registeredHeadsets.filter(h => h.id !== id);
    this.renderRegisteredHeadsets();
  }

  // === Modal Functions ===

  openAddModal() {
    this.editingHeadsetId = null;
    this.modalTitle.textContent = 'Adicionar Headset';
    this.headsetForm.reset();
    this.selectColor('blue');

    // Set next number
    const numbers = this.state.registeredHeadsets.map(h => h.number).filter(n => n);
    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    this.headsetNumberInput.value = nextNumber;

    this.headsetModal.classList.add('open');
    this.headsetNameInput.focus();
  }

  openEditModal(id) {
    const headset = this.state.registeredHeadsets.find(h => h.id === id);
    if (!headset) return;

    this.editingHeadsetId = id;
    this.modalTitle.textContent = 'Editar Headset';

    this.headsetIdInput.value = headset.id;
    this.headsetNameInput.value = headset.name;
    this.headsetNumberInput.value = headset.number || '';
    this.selectColor(headset.color || 'blue');

    this.headsetModal.classList.add('open');
    this.headsetNameInput.focus();
  }

  closeModal() {
    this.headsetModal.classList.remove('open');
    this.editingHeadsetId = null;
  }

  openDeleteModal(id) {
    const headset = this.state.registeredHeadsets.find(h => h.id === id);
    if (!headset) return;

    this.deletingHeadsetId = id;
    this.deleteHeadsetName.textContent = headset.name;
    this.deleteModal.classList.add('open');
  }

  closeDeleteModal() {
    this.deleteModal.classList.remove('open');
    this.deletingHeadsetId = null;
  }

  selectColor(color) {
    this.headsetColorInput.value = color;

    this.colorPicker.querySelectorAll('.color-option').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.color === color);
    });
  }

  async handleFormSubmit(e) {
    e.preventDefault();

    const data = {
      name: this.headsetNameInput.value.trim(),
      number: parseInt(this.headsetNumberInput.value) || null,
      color: this.headsetColorInput.value
    };

    try {
      if (this.editingHeadsetId) {
        // Update
        await fetch(`${this.apiUrl}/api/headsets/${this.editingHeadsetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        // Create
        await fetch(`${this.apiUrl}/api/headsets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }

      this.closeModal();
    } catch (error) {
      console.error('Erro ao salvar headset:', error);
      alert('Erro ao salvar headset');
    }
  }

  async confirmDelete() {
    if (!this.deletingHeadsetId) return;

    try {
      await fetch(`${this.apiUrl}/api/headsets/${this.deletingHeadsetId}`, {
        method: 'DELETE'
      });

      this.closeDeleteModal();
    } catch (error) {
      console.error('Erro ao remover headset:', error);
      alert('Erro ao remover headset');
    }
  }

  // === Utilities ===

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app
const app = new FastDriveApp();
