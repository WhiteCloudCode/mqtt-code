import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import * as mqtt from 'mqtt';
import { BrokerProfile } from '../models/broker-profile';
import { StorageService } from '../services/storage-service';
import { BrokerTreeProvider } from '../views/broker-tree-provider';
import { LogService } from '../services/log-service';

export class BrokerFormPanel {
  private static _currentPanel: BrokerFormPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _disposables: vscode.Disposable[] = [];
  private _isDisposed = false;

  private readonly storageService: StorageService;
  private readonly brokerTreeProvider: BrokerTreeProvider;
  private readonly logService: LogService;
  private readonly profileToEdit?: BrokerProfile;

  public static get currentPanel(): BrokerFormPanel | undefined {
    return BrokerFormPanel._currentPanel;
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    storageService: StorageService,
    brokerTreeProvider: BrokerTreeProvider,
    profileToEdit?: BrokerProfile
  ): BrokerFormPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (BrokerFormPanel._currentPanel) {
      BrokerFormPanel._currentPanel._panel.reveal(column);
      return BrokerFormPanel._currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'mqttCodeBrokerForm',
      profileToEdit ? `Edit Broker: ${profileToEdit.name}` : 'Add MQTT Broker',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
      }
    );

    panel.iconPath = vscode.Uri.joinPath(
      extensionUri,
      'resources',
      'icons',
      'mqtt-code-logo-transparent.svg'
    );

    BrokerFormPanel._currentPanel = new BrokerFormPanel(
      panel,
      extensionUri,
      storageService,
      brokerTreeProvider,
      profileToEdit
    );
    return BrokerFormPanel._currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    storageService: StorageService,
    brokerTreeProvider: BrokerTreeProvider,
    profileToEdit?: BrokerProfile
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this.storageService = storageService;
    this.brokerTreeProvider = brokerTreeProvider;
    this.profileToEdit = profileToEdit;
    this.logService = LogService.getInstance();

    this.updateWebviewContent();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleWebviewMessage(message);
      },
      null,
      this._disposables
    );
  }

  private async handleWebviewMessage(message: {
    type: string;
    profile?: BrokerProfile;
    password?: string;
    targetField?: string;
  }): Promise<void> {
    switch (message.type) {
      case 'ready':
      case 'requestInitData':
        await this.sendInitialData();
        break;
      case 'browseFile':
        if (message.targetField) {
          await this.handleFileBrowse(message.targetField);
        }
        break;
      case 'testConnection':
        if (message.profile) {
          await this.handleTestConnection(message.profile, message.password);
        }
        break;
      case 'saveBroker':
        if (message.profile) {
          await this.handleSaveBroker(message.profile, message.password);
        }
        break;
      case 'cancel':
        this.dispose();
        break;
      default:
        break;
    }
  }

  private async sendInitialData(): Promise<void> {
    if (this.profileToEdit) {
      const password = await this.storageService.getBrokerPassword(this.profileToEdit.id);
      this.postMessage({
        type: 'initData',
        profile: this.profileToEdit,
        password: password || '',
      });
    }
  }

  private async handleFileBrowse(targetField: string): Promise<void> {
    const selectedUris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      openLabel: 'Select Certificate / Key File',
      filters: {
        'Certificate and Key Files': ['crt', 'pem', 'key', 'cer', 'der'],
        'All Files': ['*'],
      },
    });

    if (selectedUris && selectedUris.length > 0) {
      this.postMessage({
        type: 'fileSelected',
        targetField,
        filePath: selectedUris[0].fsPath,
      });
    }
  }

  private async handleTestConnection(profile: BrokerProfile, password?: string): Promise<void> {
    const protocol = profile.protocol || 'mqtt://';
    const brokerUrl = `${protocol}${profile.host}:${profile.port}`;

    const options: mqtt.IClientOptions = {
      clientId: profile.clientId || `mqtt_test_${crypto.randomUUID().substring(0, 8)}`,
      clean: true,
      keepalive: 10,
      protocolVersion: profile.mqttVersion === '5.0' ? 5 : 4,
      connectTimeout: 5000,
      rejectUnauthorized: profile.rejectUnauthorized ?? true,
    };

    if (profile.username) {
      options.username = profile.username;
    }
    if (password) {
      options.password = password;
    }

    if (profile.caCertPath && fs.existsSync(profile.caCertPath)) {
      try {
        options.ca = fs.readFileSync(profile.caCertPath);
      } catch (e) {
        this.logService.error('Failed to read CA cert for test connection:', e);
      }
    }

    let client: mqtt.MqttClient | null = null;
    try {
      const activeClient = mqtt.connect(brokerUrl, options);
      client = activeClient;

      const testResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        const timer = setTimeout(() => {
          activeClient.removeAllListeners();
          activeClient.end(true);
          resolve({ success: false, error: 'Connection timed out after 5 seconds.' });
        }, 5000);

        activeClient.on('connect', () => {
          clearTimeout(timer);
          activeClient.removeAllListeners();
          activeClient.end(true);
          resolve({ success: true });
        });

        activeClient.on('error', (err: Error) => {
          clearTimeout(timer);
          activeClient.removeAllListeners();
          activeClient.end(true);
          resolve({ success: false, error: err.message });
        });
      });

      this.postMessage({
        type: 'testResult',
        success: testResult.success,
        error: testResult.error,
      });
    } catch (err: unknown) {
      if (client) {
        client.removeAllListeners();
        client.end(true);
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.postMessage({
        type: 'testResult',
        success: false,
        error: errorMsg,
      });
    }
  }

  private async handleSaveBroker(profile: BrokerProfile, password?: string): Promise<void> {
    try {
      await this.storageService.saveBroker(profile, password);
      this.brokerTreeProvider.refresh();
      vscode.window.showInformationMessage(`Saved broker profile "${profile.name}".`);
      this.dispose();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to save broker profile: ${errorMsg}`);
    }
  }

  private postMessage(message: unknown): void {
    if (this._isDisposed) {
      return;
    }
    try {
      this._panel.webview.postMessage(message);
    } catch (err) {
      this.logService.debug(`Failed to post message in BrokerFormPanel: ${String(err)}`);
    }
  }

  private updateWebviewContent(): void {
    const webview = this._panel.webview;
    const scriptPathOnDisk = vscode.Uri.joinPath(
      this._extensionUri,
      'dist',
      'webview',
      'broker-form',
      'main.js'
    );
    const stylePathOnDisk = vscode.Uri.joinPath(
      this._extensionUri,
      'dist',
      'webview',
      'broker-form',
      'style.css'
    );

    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
    const styleUri = webview.asWebviewUri(stylePathOnDisk);

    const nonce = crypto.randomBytes(16).toString('hex');

    const htmlPath = path.join(
      this._extensionUri.fsPath,
      'dist',
      'webview',
      'broker-form',
      'index.html'
    );
    let htmlContent: string;
    if (fs.existsSync(htmlPath)) {
      htmlContent = fs.readFileSync(htmlPath, 'utf8');
      htmlContent = htmlContent
        .replaceAll('{{nonce}}', nonce)
        .replaceAll('{{scriptUri}}', scriptUri.toString())
        .replaceAll('{{styleUri}}', styleUri.toString())
        .replaceAll('{{cspSource}}', webview.cspSource);
    } else {
      // Fallback for local development if dist doesn't have it yet
      const srcHtmlPath = path.join(
        this._extensionUri.fsPath,
        'src',
        'webview',
        'broker-form',
        'index.html'
      );
      if (fs.existsSync(srcHtmlPath)) {
        htmlContent = fs.readFileSync(srcHtmlPath, 'utf8');
        htmlContent = htmlContent
          .replaceAll('{{nonce}}', nonce)
          .replaceAll('{{scriptUri}}', scriptUri.toString())
          .replaceAll('{{styleUri}}', styleUri.toString())
          .replaceAll('{{cspSource}}', webview.cspSource);
      } else {
        htmlContent = `<!DOCTYPE html><html><body><p>Loading Broker Configuration...</p></body></html>`;
      }
    }

    webview.html = htmlContent;
  }

  public dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    BrokerFormPanel._currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
