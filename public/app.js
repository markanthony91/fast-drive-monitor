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

    // Event log
    this.eventLog = [];
    this.maxLogEntries = 50;

    // Settings
    this.settings = {
      theme: localStorage.getItem('theme') || 'dark',
      compactMode: localStorage.getItem('compactMode') === 'true',
      soundEnabled: localStorage.getItem('soundEnabled') !== 'false'
    };

    // Low battery tracking (to avoid duplicate alerts)
    this.lowBatteryAlerted = new Set();

    // Battery history for sparklines (per headset)
    this.batteryHistory = {};
    this.maxHistoryPoints = 20;

    this.init();
  }

  async init() {
    this.bindElements();
    this.bindEvents();
    this.startClock();
    this.applySettings();
    this.initEventLog();
    await this.loadInitialState();
    this.connectWebSocket();
  }

  applySettings() {
    // Apply theme
    if (this.settings.theme === 'light') {
      document.body.classList.add('light-theme');
    }
    // Apply compact mode
    if (this.settings.compactMode) {
      document.body.classList.add('compact-mode');
    }
  }

  updateToolbarState() {
    // Theme icon
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
      themeIcon.innerHTML = this.settings.theme === 'light' ? '&#9790;' : '&#9728;';
    }

    // Compact mode button
    const compactBtn = document.getElementById('compactModeBtn');
    if (compactBtn) {
      compactBtn.classList.toggle('active', this.settings.compactMode);
    }

    // Sound icon
    const soundIcon = document.getElementById('soundIcon');
    if (soundIcon) {
      soundIcon.innerHTML = this.settings.soundEnabled ? '&#128266;' : '&#128264;';
    }

    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
      soundBtn.classList.toggle('active', this.settings.soundEnabled);
    }
  }

  initEventLog() {
    const panel = document.getElementById('eventLogPanel');
    const header = document.querySelector('.event-log-header');

    // Start collapsed
    panel.classList.add('collapsed');

    header.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
    });
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

  // === Toast Notifications ===

  showToast(type, title, message, duration = 5000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      success: '✓',
      warning: '⚠',
      error: '✕',
      info: 'ℹ'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ'}</span>
      <div class="toast-content">
        <div class="toast-title">${this.escapeHtml(title)}</div>
        <div class="toast-message">${this.escapeHtml(message)}</div>
      </div>
      <button class="toast-close">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.removeToast(toast);
    });

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => this.removeToast(toast), duration);

    return toast;
  }

  removeToast(toast) {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }

  // === Event Log ===

  addEventLog(icon, text, type = 'info') {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    this.eventLog.unshift({ time, icon, text, type });

    // Keep max entries
    if (this.eventLog.length > this.maxLogEntries) {
      this.eventLog.pop();
    }

    this.renderEventLog();
  }

  renderEventLog() {
    const list = document.getElementById('eventLogList');
    list.innerHTML = this.eventLog.slice(0, 10).map(event => `
      <div class="event-log-item">
        <span class="event-log-time">${event.time}</span>
        <span class="event-log-icon">${event.icon}</span>
        <span class="event-log-text">${this.escapeHtml(event.text)}</span>
      </div>
    `).join('');
  }

  // === Time Formatting ===

  formatEstimatedTime(minutes) {
    if (!minutes || minutes <= 0) return null;

    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);

    if (hours > 0) {
      return `~${hours}h ${mins}min`;
    }
    return `~${mins}min`;
  }

  // === Sound Alert ===

  playAlertSound() {
    if (!this.settings.soundEnabled) return;

    try {
      // Create a simple beep using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      console.warn('Could not play alert sound:', e);
    }
  }

  // === Export Functions ===

  exportStats(format = 'json') {
    const data = {
      exportedAt: new Date().toISOString(),
      serverInfo: this.serverInfo,
      headsets: this.state.registeredHeadsets,
      activeHeadsets: this.state.activeHeadsets,
      dongles: this.state.connectedDongles,
      eventLog: this.eventLog
    };

    if (format === 'json') {
      this.downloadFile(
        JSON.stringify(data, null, 2),
        `fast-drive-export-${Date.now()}.json`,
        'application/json'
      );
    } else if (format === 'csv') {
      const csvData = this.convertToCSV(data.headsets);
      this.downloadFile(
        csvData,
        `fast-drive-headsets-${Date.now()}.csv`,
        'text/csv'
      );
    }

    this.showToast('success', 'Exportado', `Dados exportados em formato ${format.toUpperCase()}`);
    this.addEventLog('📥', `Dados exportados (${format.toUpperCase()})`);
  }

  convertToCSV(data) {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(row =>
      headers.map(h => JSON.stringify(row[h] ?? '')).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // === Theme Toggle ===

  toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    this.settings.theme = isLight ? 'light' : 'dark';
    localStorage.setItem('theme', this.settings.theme);
    this.updateToolbarState();
    this.addEventLog('🎨', `Tema alterado para ${isLight ? 'claro' : 'escuro'}`);
  }

  // === Compact Mode ===

  toggleCompactMode() {
    const isCompact = document.body.classList.toggle('compact-mode');
    this.settings.compactMode = isCompact;
    localStorage.setItem('compactMode', isCompact);
    this.updateToolbarState();
    this.addEventLog('📐', `Modo ${isCompact ? 'compacto' : 'normal'} ativado`);
  }

  // === Sound Toggle ===

  toggleSound() {
    this.settings.soundEnabled = !this.settings.soundEnabled;
    localStorage.setItem('soundEnabled', this.settings.soundEnabled);
    this.updateToolbarState();
    this.showToast('info', 'Som', this.settings.soundEnabled ? 'Alertas sonoros ativados' : 'Alertas sonoros desativados');
  }

  // === Battery Alert Check ===

  checkBatteryAlert(headset) {
    const level = headset.batteryLevel ?? 100;
    const id = headset.id;

    if (level < 20 && !headset.isCharging) {
      if (!this.lowBatteryAlerted.has(id)) {
        this.lowBatteryAlerted.add(id);
        this.showToast('warning', 'Bateria Baixa', `${headset.name}: ${level}%`, 8000);
        this.addEventLog('🔋', `Bateria baixa: ${headset.name} (${level}%)`, 'warning');
        this.playAlertSound();
      }
    } else if (level >= 20 || headset.isCharging) {
      this.lowBatteryAlerted.delete(id);
    }
  }

  // === Battery History / Sparkline ===

  recordBatteryLevel(headsetId, level) {
    if (!this.batteryHistory[headsetId]) {
      this.batteryHistory[headsetId] = [];
    }

    this.batteryHistory[headsetId].push({
      level,
      time: Date.now()
    });

    // Keep only last N points
    if (this.batteryHistory[headsetId].length > this.maxHistoryPoints) {
      this.batteryHistory[headsetId].shift();
    }
  }

  generateSparkline(headsetId, width = 60, height = 20) {
    const history = this.batteryHistory[headsetId];
    if (!history || history.length < 2) {
      return '';
    }

    const points = history.map((h, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - (h.level / 100) * height;
      return `${x},${y}`;
    });

    const lastLevel = history[history.length - 1].level;
    const color = lastLevel < 20 ? '#EF4444' : lastLevel < 50 ? '#EAB308' : '#22C55E';

    return `
      <svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <polyline
          fill="none"
          stroke="${color}"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          points="${points.join(' ')}"
        />
      </svg>
    `;
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

    // Toolbar buttons
    document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportStats('json'));
    document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportStats('csv'));
    document.getElementById('themeToggleBtn').addEventListener('click', () => this.toggleTheme());
    document.getElementById('compactModeBtn').addEventListener('click', () => this.toggleCompactMode());
    document.getElementById('soundToggleBtn').addEventListener('click', () => this.toggleSound());

    // Update toolbar button states
    this.updateToolbarState();
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
        this.addEventLog('🔌', 'Conexão estabelecida com o servidor');
        break;

      case 'dongleConnected':
        this.addDongle(message.data);
        this.addEventLog('📡', `Dongle conectado: ${message.data.name || 'Jabra Dongle'}`);
        this.showToast('success', 'Dongle Conectado', message.data.name || 'Jabra Dongle');
        break;

      case 'dongleDisconnected':
        this.removeDongle(message.data.id);
        this.addEventLog('📡', 'Dongle desconectado', 'warning');
        this.showToast('warning', 'Dongle Desconectado', 'Um dongle foi removido');
        break;

      case 'headsetTurnedOn':
        this.addActiveHeadset(message.data);
        this.addEventLog('🎧', `Headset ligado: ${message.data.name}`);
        this.showToast('success', 'Headset Online', message.data.name);
        break;

      case 'headsetTurnedOff':
        const offHeadset = this.state.activeHeadsets.find(h => h.id === message.data.id);
        const offName = offHeadset?.name || 'Headset';
        this.removeActiveHeadset(message.data.id);
        this.addEventLog('🎧', `Headset desligado: ${offName}`, 'warning');
        this.showToast('warning', 'Headset Offline', `${offName} foi desconectado`);
        this.playAlertSound();
        break;

      case 'headsetStateUpdated':
        this.updateActiveHeadset(message.data);
        // Log significant battery changes
        if (message.data.batteryLevel !== undefined) {
          const existing = this.state.activeHeadsets.find(h => h.id === message.data.id);
          if (existing && Math.abs((existing.batteryLevel || 0) - message.data.batteryLevel) >= 5) {
            this.addEventLog('🔋', `${message.data.name}: ${message.data.batteryLevel}%`);
          }
        }
        break;

      case 'headsetRegistered':
        this.addRegisteredHeadset(message.data);
        this.addEventLog('➕', `Headset registrado: ${message.data.name}`);
        this.showToast('success', 'Headset Registrado', message.data.name);
        break;

      case 'headsetUpdated':
        this.updateRegisteredHeadset(message.data);
        this.addEventLog('✏️', `Headset atualizado: ${message.data.name}`);
        break;

      case 'headsetRemoved':
        const removed = this.state.registeredHeadsets.find(h => h.id === message.data.id);
        this.removeRegisteredHeadset(message.data.id);
        this.addEventLog('🗑️', `Headset removido: ${removed?.name || 'Unknown'}`);
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

    // Add battery-low class for visual alert
    if (batteryLevel < 20 && !headset.isCharging) {
      card.classList.add('battery-low');
    }

    // Check battery alert
    this.checkBatteryAlert(headset);

    // Record battery level for sparkline
    if (headset.batteryLevel !== undefined) {
      this.recordBatteryLevel(headset.id, headset.batteryLevel);
    }

    // Generate sparkline
    const sparklineHtml = this.generateSparkline(headset.id);

    // Estimated time
    let estimateHtml = '';
    if (headset.isCharging && headset.estimatedTimeToFull) {
      const timeStr = this.formatEstimatedTime(headset.estimatedTimeToFull);
      if (timeStr) {
        estimateHtml = `<div class="battery-estimate charging">Carga completa em ${timeStr}</div>`;
      }
    } else if (!headset.isCharging && headset.estimatedTimeToEmpty) {
      const timeStr = this.formatEstimatedTime(headset.estimatedTimeToEmpty);
      if (timeStr) {
        estimateHtml = `<div class="battery-estimate">Restante: ${timeStr}</div>`;
      }
    }

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
          ${sparklineHtml}
        </div>
        ${estimateHtml}
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
