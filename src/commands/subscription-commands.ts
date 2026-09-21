import * as vscode from 'vscode';
import {
  SubscriptionTreeItem,
  SubscriptionBrokerTreeItem,
} from '../views/subscription-tree-provider';
import { ConnectionManager } from '../services/connection-manager';

export async function handleAddSubscription(
  item: SubscriptionBrokerTreeItem | undefined,
  connectionManager: ConnectionManager
) {
  let brokerId = item?.brokerId;
  if (!brokerId) {
    const connectedBrokers = connectionManager.getConnectedBrokers();
    if (connectedBrokers.length === 0) {
      vscode.window.showWarningMessage(
        'Please connect to an MQTT broker before adding a subscription.'
      );
      return;
    } else if (connectedBrokers.length === 1) {
      brokerId = connectedBrokers[0].id;
    } else {
      const picked = await vscode.window.showQuickPick(
        connectedBrokers.map((b) => ({
          label: b.name,
          description: `${b.host}:${b.port}`,
          brokerId: b.id,
        })),
        { placeHolder: 'Select broker for subscription' }
      );
      if (!picked) {
        return;
      }
      brokerId = picked.brokerId;
    }
  }

  const filter = await vscode.window.showInputBox({
    prompt: 'Enter topic subscription filter (supports wildcards # and +)',
    placeHolder: 'e.g. # or sensors/+/temperature',
    value: '#',
    validateInput: (val) => (val.trim().length === 0 ? 'Topic filter cannot be empty' : null),
  });
  if (!filter) {
    return;
  }

  const qosPick = await vscode.window.showQuickPick(
    [
      { label: '0', description: 'At most once' },
      { label: '1', description: 'At least once' },
      { label: '2', description: 'Exactly once' },
    ],
    { placeHolder: 'Select subscription QoS level' }
  );
  const qos = (qosPick ? Number.parseInt(qosPick.label, 10) : 0) as 0 | 1 | 2;

  try {
    await connectionManager.subscribe(brokerId, filter.trim(), qos);
    vscode.window.showInformationMessage(`Subscribed to topic filter: ${filter}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to subscribe: ${msg}`);
  }
}

export async function handleEditSubscription(
  item: SubscriptionTreeItem | undefined,
  connectionManager: ConnectionManager
) {
  const topicFilter = item?.topicFilter;
  const brokerId = item?.brokerId;

  if (!topicFilter || !brokerId) {
    vscode.window.showInformationMessage(
      'Please edit subscriptions via the tree view inline action.'
    );
    return;
  }

  const newFilter = await vscode.window.showInputBox({
    prompt: 'Edit topic subscription filter',
    value: topicFilter,
    validateInput: (val) => (val.trim().length === 0 ? 'Topic filter cannot be empty' : null),
  });

  if (!newFilter || newFilter.trim() === topicFilter) {
    return;
  }

  const qosPick = await vscode.window.showQuickPick(
    [
      { label: '0', description: 'At most once' },
      { label: '1', description: 'At least once' },
      { label: '2', description: 'Exactly once' },
    ],
    { placeHolder: 'Select subscription QoS level' }
  );
  if (!qosPick) {
    return;
  }
  const qos = Number.parseInt(qosPick.label, 10) as 0 | 1 | 2;

  try {
    await connectionManager.unsubscribe(brokerId, topicFilter);
    await connectionManager.subscribe(brokerId, newFilter.trim(), qos);
    vscode.window.showInformationMessage(`Updated subscription to: ${newFilter}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to edit subscription: ${msg}`);
  }
}

export async function handleRemoveSubscription(
  item: SubscriptionTreeItem | undefined,
  connectionManager: ConnectionManager
) {
  const topicFilter = item?.topicFilter;
  const brokerId = item?.brokerId;

  if (!topicFilter || !brokerId) {
    vscode.window.showInformationMessage(
      'Please remove subscriptions via the tree view inline action.'
    );
    return;
  }

  try {
    await connectionManager.unsubscribe(brokerId, topicFilter);
    vscode.window.showInformationMessage(`Unsubscribed from: ${topicFilter}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to unsubscribe: ${msg}`);
  }
}
