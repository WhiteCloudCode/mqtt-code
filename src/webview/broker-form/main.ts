// Broker Form Webview Client Script
import { BrokerProfile, MqttProtocol, MqttVersion } from '../../models/broker-profile';
import { BrokerFormToExtensionMessage } from '../../types/broker-form-messages';

interface VsCodeApi {
  postMessage(message: BrokerFormToExtensionMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

// Form Elements
const form = document.getElementById('broker-form') as HTMLFormElement;
const formHeading = document.getElementById('form-heading') as HTMLElement;
const profileNameInput = document.getElementById('profile-name') as HTMLInputElement;
const protocolSelect = document.getElementById('protocol') as HTMLSelectElement;
const hostInput = document.getElementById('host') as HTMLInputElement;
const portInput = document.getElementById('port') as HTMLInputElement;
const clientIdInput = document.getElementById('client-id') as HTMLInputElement;
const btnGenerateClientId = document.getElementById('btn-generate-client-id') as HTMLButtonElement;
const usernameInput = document.getElementById('username') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const btnTogglePassword = document.getElementById('btn-toggle-password') as HTMLButtonElement;
const mqttVersionSelect = document.getElementById('mqtt-version') as HTMLSelectElement;
const keepaliveInput = document.getElementById('keepalive') as HTMLInputElement;
const subscriptionsInput = document.getElementById('subscriptions') as HTMLInputElement;
const cleanSessionCheckbox = document.getElementById('clean-session') as HTMLInputElement;
const rejectUnauthorizedCheckbox = document.getElementById(
  'reject-unauthorized'
) as HTMLInputElement;
const caCertPathInput = document.getElementById('ca-cert-path') as HTMLInputElement;
const clientCertPathInput = document.getElementById('client-cert-path') as HTMLInputElement;
const clientKeyPathInput = document.getElementById('client-key-path') as HTMLInputElement;
const testResultBanner = document.getElementById('test-result-banner') as HTMLElement;
const btnTestConnection = document.getElementById('btn-test-connection') as HTMLButtonElement;
const btnCancel = document.getElementById('btn-cancel') as HTMLButtonElement;

let currentBrokerId: string | null = null;
let createdAtTimestamp: number = Date.now();

function getDefaultPortForProtocol(protocol: string): string {
  switch (protocol) {
    case 'mqtts://':
      return '8883';
    case 'wss://':
      return '8084';
    case 'ws://':
      return '8083';
    case 'mqtt://':
    default:
      return '1883';
  }
}

function generateRandomClientId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(8);
  window.crypto.getRandomValues(array);
  let result = 'mqtt_code_';
  for (const byte of array) {
    result += chars.charAt(byte % chars.length);
  }
  return result;
}

function initialiseEventListeners(): void {
  // Auto-update default port when protocol changes
  protocolSelect.addEventListener('change', () => {
    portInput.value = getDefaultPortForProtocol(protocolSelect.value);
  });

  // Generate Client ID
  btnGenerateClientId.addEventListener('click', () => {
    clientIdInput.value = generateRandomClientId();
  });

  // Toggle Password Visibility
  btnTogglePassword.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      btnTogglePassword.textContent = 'Hide';
    } else {
      passwordInput.type = 'password';
      btnTogglePassword.textContent = 'Show';
    }
  });

  // File Browse buttons
  document.querySelectorAll('.btn-browse-file').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const targetField = target.dataset.target;
      if (targetField) {
        vscode.postMessage({
          type: 'browseFile',
          targetField,
        });
      }
    });
  });

  // Test Connection
  btnTestConnection.addEventListener('click', () => {
    const profile = buildProfileFromForm();
    if (!profile) {
      return;
    }

    showBanner('Testing connection to broker...', 'testing');
    vscode.postMessage({
      type: 'testConnection',
      profile,
      password: passwordInput.value,
    });
  });

  // Cancel
  btnCancel.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  // Form Submit (Save)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const profile = buildProfileFromForm();
    if (!profile) {
      return;
    }

    vscode.postMessage({
      type: 'saveBroker',
      profile,
      password: passwordInput.value,
    });
  });

  // Message receiver
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== window.location.origin && event.origin !== '') {
      return;
    }
    if (!event.data || typeof event.data !== 'object') {
      return;
    }

    const msg = event.data;
    switch (msg.type) {
      case 'initData':
        populateForm(msg.profile, msg.password);
        break;
      case 'fileSelected':
        handleFileSelected(msg.targetField, msg.filePath);
        break;
      case 'testResult':
        if (msg.success) {
          showBanner('Connection successful! Broker is reachable.', 'success');
        } else {
          showBanner(`Connection failed: ${msg.error || 'Unknown error'}`, 'error');
        }
        break;
      default:
        break;
    }
  });

  // Request initial profile data if in edit mode
  vscode.postMessage({ type: 'requestInitData' });
}

function buildProfileFromForm(): BrokerProfile | null {
  const name = profileNameInput.value.trim();
  const host = hostInput.value.trim();
  const portStr = portInput.value.trim();

  if (!name) {
    showBanner('Profile Name is required.', 'error');
    profileNameInput.focus();
    return null;
  }
  if (!host) {
    showBanner('Host is required.', 'error');
    hostInput.focus();
    return null;
  }

  const port = Number.parseInt(portStr, 10);
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    showBanner('Port must be a valid number between 1 and 65535.', 'error');
    portInput.focus();
    return null;
  }

  const subscriptions = subscriptionsInput.value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const keepaliveVal = Number.parseInt(keepaliveInput.value, 10);

  return {
    id: currentBrokerId || `broker_${Date.now()}`,
    name,
    protocol: protocolSelect.value as MqttProtocol,
    host,
    port,
    clientId: clientIdInput.value.trim() || undefined,
    username: usernameInput.value.trim() || undefined,
    mqttVersion: mqttVersionSelect.value as MqttVersion,
    cleanSession: cleanSessionCheckbox.checked,
    keepalive: Number.isNaN(keepaliveVal) ? 60 : keepaliveVal,
    rejectUnauthorized: rejectUnauthorizedCheckbox.checked,
    caCertPath: caCertPathInput.value.trim() || undefined,
    clientCertPath: clientCertPathInput.value.trim() || undefined,
    clientKeyPath: clientKeyPathInput.value.trim() || undefined,
    subscriptions: subscriptions.length > 0 ? subscriptions : ['#'],
    createdAt: createdAtTimestamp,
  };
}

function populateForm(profile?: BrokerProfile | null, password?: string): void {
  if (!profile) {
    return;
  }

  currentBrokerId = profile.id;
  createdAtTimestamp = profile.createdAt || Date.now();
  formHeading.textContent = 'Edit MQTT Broker';

  profileNameInput.value = profile.name || '';
  protocolSelect.value = profile.protocol || 'mqtt://';
  hostInput.value = profile.host || '';
  portInput.value = profile.port ? profile.port.toString() : '1883';
  clientIdInput.value = profile.clientId || '';
  usernameInput.value = profile.username || '';
  if (password !== undefined) {
    passwordInput.value = password;
  }
  mqttVersionSelect.value = profile.mqttVersion || '3.1.1';
  keepaliveInput.value = profile.keepalive !== undefined ? profile.keepalive.toString() : '60';
  subscriptionsInput.value = profile.subscriptions ? profile.subscriptions.join(', ') : '#';
  cleanSessionCheckbox.checked = profile.cleanSession !== false;
  rejectUnauthorizedCheckbox.checked = profile.rejectUnauthorized !== false;
  caCertPathInput.value = profile.caCertPath || '';
  clientCertPathInput.value = profile.clientCertPath || '';
  clientKeyPathInput.value = profile.clientKeyPath || '';
}

function handleFileSelected(targetField: string, filePath: string): void {
  const el = document.getElementById(targetField) as HTMLInputElement | null;
  if (el && filePath) {
    el.value = filePath;
  }
}

function showBanner(message: string, type: 'success' | 'error' | 'testing'): void {
  testResultBanner.className = `result-banner ${type}`;
  testResultBanner.textContent = message;
  testResultBanner.style.display = 'block';
}

// Initialise
initialiseEventListeners();
