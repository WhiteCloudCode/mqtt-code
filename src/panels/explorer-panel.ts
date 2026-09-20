import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { ConnectionManager } from '../services/connection-manager';
import { TopicTreeManager } from '../services/topic-tree-manager';
import { PublishRequest } from '../models/mqtt-message';
import { LogService } from '../services/log-service';
import { BrokerConnectionStatus } from '../models/broker-profile';

import { StorageService } from '../services/storage-service';

export class ExplorerPanel {
  private static panels: Map<string, ExplorerPanel> = new Map();
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _disposables: vscode.Disposable[] = [];
  private _isDisposed = false;

  private readonly connectionManager: ConnectionManager;
  private readonly topicTreeManager: TopicTreeManager;
  private readonly storageService: StorageService;
  private readonly logService: LogService;
  private readonly brokerId: string;
  private updateThrottleTimer: NodeJS.Timeout | null = null;
  private currentSelectedTopic: string | undefined;

  private readonly _onTopicTreeChange = () => this.throttleStateUpdate();

  private readonly _onStatusChange = (status: BrokerConnectionStatus) => {
    if (status.brokerId === this.brokerId) {
      this.sendConnectionStatus();
    }
  };

  private readonly _onSubscriptionChange = (changedBrokerId: string, subs: string[]) => {
    if (changedBrokerId === this.brokerId) {
      this.postMessage({
        type: 'subscriptionsUpdate',
        subscriptions: subs,
      });
    }
  };

  public static getPanel(brokerId: string): ExplorerPanel | undefined {
    return ExplorerPanel.panels.get(brokerId);
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    connectionManager: ConnectionManager,
    brokerId: string,
    storageService: StorageService
  ): ExplorerPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    const existingPanel = ExplorerPanel.panels.get(brokerId);
    if (existingPanel) {
      existingPanel._panel.reveal(column);
      existingPanel.sendFullState();
      return existingPanel;
    }

    const broker = connectionManager.getActiveBroker(brokerId);
    const title = broker ? `MQTT: ${broker.name}` : `MQTT: Explorer`;

    const panel = vscode.window.createWebviewPanel(
      'mqttCodeExplorer',
      title,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'resources'),
        ],
      }
    );

    panel.iconPath = vscode.Uri.joinPath(
      extensionUri,
      'resources',
      'icons',
      'mqtt-code-logo-transparent.svg'
    );

    const newPanel = new ExplorerPanel(
      panel,
      extensionUri,
      connectionManager,
      brokerId,
      storageService
    );
    ExplorerPanel.panels.set(brokerId, newPanel);
    return newPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    connectionManager: ConnectionManager,
    brokerId: string,
    storageService: StorageService
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this.connectionManager = connectionManager;
    this.brokerId = brokerId;
    this.storageService = storageService;
    this.logService = LogService.getInstance();

    const ttm = connectionManager.getTopicTreeManager(brokerId);
    if (!ttm) {
      throw new Error(`No TopicTreeManager found for broker ${brokerId}`);
    }
    this.topicTreeManager = ttm;

    this.updateWebviewContent();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle incoming messages from Webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleWebviewMessage(message);
      },
      null,
      this._disposables
    );

    // Listen to topic tree changes and throttle notifications to webview
    this.topicTreeManager.on('change', this._onTopicTreeChange);

    // Listen to connection status changes
    this.connectionManager.on('statusChange', this._onStatusChange);
    this.connectionManager.on('subscriptionChange', this._onSubscriptionChange);
  }

  private async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.type) {
      case 'requestState':
        this.sendFullState();
        break;
      case 'requestHistory':
        if (message.topic) {
          this.currentSelectedTopic = message.topic;
          this.sendTopicHistory(message.topic);
        }
        break;
      case 'publish':
        await this.onPublishRequested(message.data as PublishRequest);
        break;
      case 'subscribe':
        await this.onSubscribeRequested(message.topic, message.qos);
        break;
      case 'unsubscribe':
        await this.onUnsubscribeRequested(message.topic);
        break;
      case 'clearTree':
        this.topicTreeManager.clear();
        break;
      case 'savePublisherState':
        await this.storageService.setPublisherOpenState(Boolean(message.data));
        break;
      case 'saveLayoutState': {
        const payload = message.data as { topicPaneWidth?: string } | undefined;
        if (payload?.topicPaneWidth) {
          await this.storageService.setTopicPaneWidth(payload.topicPaneWidth);
        }
        break;
      }
      default:
        break;
    }
  }

  private async onPublishRequested(req: PublishRequest): Promise<void> {
    try {
      await this.connectionManager.publish(this.brokerId, req);
      vscode.window.showInformationMessage(`Published message to ${req.topic}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logService.error(`Publish error on ${req.topic}: ${errorMsg}`, err);
      vscode.window.showErrorMessage(`Failed to publish message: ${errorMsg}`);
    }
  }

  private async onSubscribeRequested(topic?: string, qos: 0 | 1 | 2 = 0): Promise<void> {
    if (!topic) {
      return;
    }
    try {
      await this.connectionManager.subscribe(this.brokerId, topic, qos);
      vscode.window.showInformationMessage(`Subscribed to ${topic}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logService.error(`Subscribe error on ${topic}: ${errorMsg}`, err);
      vscode.window.showErrorMessage(`Failed to subscribe: ${errorMsg}`);
    }
  }

  private async onUnsubscribeRequested(topic?: string): Promise<void> {
    if (!topic) {
      return;
    }
    try {
      await this.connectionManager.unsubscribe(this.brokerId, topic);
      vscode.window.showInformationMessage(`Unsubscribed from ${topic}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logService.error(`Unsubscribe error on ${topic}: ${errorMsg}`, err);
      vscode.window.showErrorMessage(`Failed to unsubscribe: ${errorMsg}`);
    }
  }

  private throttleStateUpdate(): void {
    if (this._isDisposed || this.updateThrottleTimer) {
      return;
    }
    this.updateThrottleTimer = setTimeout(() => {
      this.updateThrottleTimer = null;
      this.sendFullState();
    }, 150);
  }

  public sendFullState(): void {
    if (this._isDisposed) {
      return;
    }
    const root = this.topicTreeManager.getSerialisedRoot();
    const activeBroker = this.connectionManager.getActiveBroker(this.brokerId);
    const status = this.connectionManager.getConnectionStatus(this.brokerId);
    const subscriptions = this.connectionManager.getSubscriptions(this.brokerId);

    this.postMessage({
      type: 'fullStateUpdate',
      tree: root,
      broker: activeBroker,
      status,
      subscriptions,
    });

    if (this.currentSelectedTopic) {
      this.sendTopicHistory(this.currentSelectedTopic);
    }
  }

  public sendConnectionStatus(): void {
    if (this._isDisposed) {
      return;
    }
    const status = this.connectionManager.getConnectionStatus(this.brokerId);
    const broker = this.connectionManager.getActiveBroker(this.brokerId);
    this.postMessage({
      type: 'statusUpdate',
      status,
      broker,
    });
  }

  public sendTopicHistory(topic: string): void {
    if (this._isDisposed) {
      return;
    }
    const history = this.topicTreeManager.getMessageHistory(topic);
    this.postMessage({
      type: 'historyUpdate',
      topic,
      history,
    });
  }

  private postMessage(message: unknown): void {
    if (this._isDisposed) {
      return;
    }
    try {
      this._panel.webview.postMessage(message);
    } catch (err) {
      this.logService.debug(`Failed to post message to webview: ${String(err)}`);
    }
  }

  private updateWebviewContent(): void {
    const webview = this._panel.webview;
    const stylePathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'style.css');

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'main.js')
    );
    const monacoBaseUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'vs')
    );
    const monacoLoaderUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'vs', 'loader.js')
    );
    const styleUri = webview.asWebviewUri(stylePathOnDisk);

    const nonce = getNonce();

    const isPublisherOpen = this.storageService.getPublisherOpenState();
    const publisherOpenAttr = isPublisherOpen ? 'open' : '';

    const topicPaneWidth = this.storageService.getTopicPaneWidth();
    const topicPaneWidthStyle = topicPaneWidth ? `width: ${topicPaneWidth};` : '';

    const htmlPath = path.join(this._extensionUri.fsPath, 'dist', 'webview', 'index.html');
    let htmlContent: string;
    if (fs.existsSync(htmlPath)) {
      htmlContent = fs.readFileSync(htmlPath, 'utf8');
      htmlContent = htmlContent
        .replaceAll('{{nonce}}', nonce)
        .replaceAll('{{scriptUri}}', scriptUri.toString())
        .replaceAll('{{styleUri}}', styleUri.toString())
        .replaceAll('{{cspSource}}', webview.cspSource)
        .replaceAll('{{publisherOpenAttr}}', publisherOpenAttr)
        .replaceAll('{{topicPaneWidthStyle}}', topicPaneWidthStyle)
        .replaceAll('{{monacoBaseUri}}', monacoBaseUri.toString())
        .replaceAll('{{monacoLoaderUri}}', monacoLoaderUri.toString());
    } else {
      // Fallback for local development if dist doesn't have it yet
      const srcHtmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'index.html');
      if (fs.existsSync(srcHtmlPath)) {
        htmlContent = fs.readFileSync(srcHtmlPath, 'utf8');
        htmlContent = htmlContent
          .replaceAll('{{nonce}}', nonce)
          .replaceAll('{{scriptUri}}', scriptUri.toString())
          .replaceAll('{{styleUri}}', styleUri.toString())
          .replaceAll('{{cspSource}}', webview.cspSource)
          .replaceAll('{{publisherOpenAttr}}', publisherOpenAttr)
          .replaceAll('{{topicPaneWidthStyle}}', topicPaneWidthStyle)
          .replaceAll('{{monacoBaseUri}}', monacoBaseUri.toString())
          .replaceAll('{{monacoLoaderUri}}', monacoLoaderUri.toString());
      } else {
        htmlContent = `<!DOCTYPE html><html><body><p>Loading MQTT Code Explorer...</p></body></html>`;
      }
    }

    webview.html = htmlContent;
  }

  public dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    ExplorerPanel.panels.delete(this.brokerId);

    if (this.updateThrottleTimer) {
      clearTimeout(this.updateThrottleTimer);
      this.updateThrottleTimer = null;
    }

    this.topicTreeManager.removeListener('change', this._onTopicTreeChange);
    this.connectionManager.removeListener('statusChange', this._onStatusChange);
    this.connectionManager.removeListener('subscriptionChange', this._onSubscriptionChange);

    // Auto-disconnect when the webview tab is closed
    this.connectionManager.disconnect(this.brokerId).catch((err) => {
      console.error(`Failed to auto-disconnect from broker ${this.brokerId}:`, err);
    });

    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

function getNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}
