import * as vscode from 'vscode';
import { BrokerProfile, BrokerConnectionStatus } from '../models/broker-profile';
import { StorageService } from '../services/storage-service';
import { ConnectionManager } from '../services/connection-manager';

export type BrokerTreeDataChangeEvent = BrokerTreeItem | undefined | null | void;

export class BrokerTreeItem extends vscode.TreeItem {
  constructor(
    public readonly profile: BrokerProfile,
    public readonly status: BrokerConnectionStatus
  ) {
    super(profile.name, vscode.TreeItemCollapsibleState.None);

    const currentState = status.state;

    this.description = `${profile.protocol}${profile.host}:${profile.port}`;
    this.tooltip = `Name: ${profile.name}\nBroker: ${this.description}\nProtocol: ${profile.mqttVersion || '3.1.1'}\nStatus: ${currentState}`;

    if (currentState === 'connected') {
      this.contextValue = 'broker-connected';
      this.iconPath = new vscode.ThemeIcon('plug', new vscode.ThemeColor('testing.iconPassed'));
    } else if (currentState === 'connecting' || currentState === 'reconnecting') {
      this.contextValue = 'broker-connecting';
      this.iconPath = new vscode.ThemeIcon(
        'sync~spin',
        new vscode.ThemeColor('testing.iconQueued')
      );
    } else if (currentState === 'error') {
      this.contextValue = 'broker-error';
      this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
    } else {
      this.contextValue = 'broker-disconnected';
      this.iconPath = new vscode.ThemeIcon('circle-outline');
    }
  }
}

export class BrokerTreeProvider implements vscode.TreeDataProvider<BrokerTreeItem> {
  private readonly _onDidChangeTreeData: vscode.EventEmitter<BrokerTreeDataChangeEvent> =
    new vscode.EventEmitter<BrokerTreeDataChangeEvent>();
  readonly onDidChangeTreeData: vscode.Event<BrokerTreeDataChangeEvent> =
    this._onDidChangeTreeData.event;
  private readonly storageService: StorageService;
  private readonly connectionManager: ConnectionManager;

  constructor(storageService: StorageService, connectionManager: ConnectionManager) {
    this.storageService = storageService;
    this.connectionManager = connectionManager;
    this.connectionManager.on('statusChange', () => {
      this.refresh();
    });
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: BrokerTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: BrokerTreeItem): Promise<BrokerTreeItem[]> {
    if (element) {
      return [];
    }

    const brokers = await this.storageService.getBrokers();

    return brokers.map((broker) => {
      const status = this.connectionManager.getConnectionStatus(broker.id);
      return new BrokerTreeItem(broker, status);
    });
  }
}
