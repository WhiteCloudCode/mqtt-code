import * as vscode from 'vscode';
import { ConnectionManager } from '../services/connection-manager';

export type SubscriptionDataChangeEvent = vscode.TreeItem | undefined | null | void;

export class SubscriptionBrokerTreeItem extends vscode.TreeItem {
  constructor(
    public readonly brokerId: string,
    public readonly brokerName: string
  ) {
    super(brokerName, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'subscription-broker';
    this.iconPath = new vscode.ThemeIcon('server');
    this.tooltip = `Subscriptions for ${brokerName}`;
  }
}

export class SubscriptionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly topicFilter: string,
    public readonly brokerId: string
  ) {
    super(topicFilter, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'subscription-item';
    this.iconPath = new vscode.ThemeIcon('tag');
    this.tooltip = `Subscribed Topic Filter: ${topicFilter}`;
  }
}

export class SubscriptionTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData: vscode.EventEmitter<SubscriptionDataChangeEvent> =
    new vscode.EventEmitter<SubscriptionDataChangeEvent>();
  readonly onDidChangeTreeData: vscode.Event<SubscriptionDataChangeEvent> =
    this._onDidChangeTreeData.event;
  private readonly connectionManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.connectionManager.on('subscriptionChange', () => {
      this.refresh();
    });
    this.connectionManager.on('statusChange', () => {
      this.refresh();
    });
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (element) {
      if (element instanceof SubscriptionBrokerTreeItem) {
        const subscriptions = this.connectionManager.getSubscriptions(element.brokerId);
        return subscriptions.map((sub) => new SubscriptionTreeItem(sub, element.brokerId));
      }
      return [];
    }

    const connectedBrokers = this.connectionManager.getConnectedBrokers();
    if (connectedBrokers.length === 0) {
      return [];
    }

    // Return the brokers as top level items
    return connectedBrokers.map((b) => new SubscriptionBrokerTreeItem(b.id, b.name));
  }
}
