import * as vscode from 'vscode';
import { BrokerTreeItem, BrokerTreeProvider } from '../views/broker-tree-provider';
import { ConnectionManager } from '../services/connection-manager';
import { StorageService } from '../services/storage-service';
import { BrokerFormPanel } from '../panels/broker-form-panel';
import { ExplorerPanel } from '../panels/explorer-panel';

export async function handleOpenExplorer(
  item: BrokerTreeItem | undefined,
  connectionManager: ConnectionManager,
  extensionUri: vscode.Uri,
  storageService: StorageService
) {
  let brokerId = item?.profile.id;
  if (!brokerId) {
    const connectedBrokers = connectionManager.getConnectedBrokers();
    if (connectedBrokers.length === 0) {
      vscode.window.showInformationMessage('No active connections to open.');
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
        { placeHolder: 'Select active broker to open Explorer for' }
      );
      if (!picked) {
        return;
      }
      brokerId = picked.brokerId;
    }
  }
  ExplorerPanel.createOrShow(extensionUri, connectionManager, brokerId, storageService);
}

export async function handleDisconnectBroker(
  item: BrokerTreeItem | undefined,
  connectionManager: ConnectionManager
) {
  let brokerId = item?.profile.id;
  if (!brokerId) {
    const connectedBrokers = connectionManager.getConnectedBrokers();
    if (connectedBrokers.length === 0) {
      return;
    }
    if (connectedBrokers.length === 1) {
      brokerId = connectedBrokers[0].id;
    } else {
      const picked = await vscode.window.showQuickPick(
        connectedBrokers.map((b) => ({
          label: b.name,
          description: `${b.host}:${b.port}`,
          brokerId: b.id,
        })),
        { placeHolder: 'Select broker to disconnect' }
      );
      if (!picked) {
        return;
      }
      brokerId = picked.brokerId;
    }
  }
  await connectionManager.disconnect(brokerId);
  vscode.window.showInformationMessage('Disconnected from MQTT broker.');
}

export async function handleEditBroker(
  item: BrokerTreeItem | undefined,
  extensionUri: vscode.Uri,
  storageService: StorageService,
  brokerTreeProvider: BrokerTreeProvider
) {
  let profile = item?.profile;
  if (!profile) {
    const brokers = await storageService.getBrokers();
    if (brokers.length === 0) {
      vscode.window.showInformationMessage('No broker profiles available to edit.');
      return;
    }
    const picked = await vscode.window.showQuickPick(
      brokers.map((b) => ({
        label: b.name,
        description: `${b.protocol}${b.host}:${b.port}`,
        broker: b,
      })),
      { placeHolder: 'Select broker to edit' }
    );
    if (!picked) {
      return;
    }
    profile = picked.broker;
  }

  BrokerFormPanel.createOrShow(extensionUri, storageService, brokerTreeProvider, profile);
}

export async function handleDeleteBroker(
  item: BrokerTreeItem | undefined,
  storageService: StorageService,
  brokerTreeProvider: BrokerTreeProvider,
  connectionManager: ConnectionManager
) {
  let profile = item?.profile;
  if (!profile) {
    const brokers = await storageService.getBrokers();
    if (brokers.length === 0) {
      vscode.window.showInformationMessage('No broker profiles available to delete.');
      return;
    }
    const picked = await vscode.window.showQuickPick(
      brokers.map((b) => ({
        label: b.name,
        description: `${b.protocol}${b.host}:${b.port}`,
        broker: b,
      })),
      { placeHolder: 'Select broker to delete' }
    );
    if (!picked) {
      return;
    }
    profile = picked.broker;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to delete broker profile "${profile.name}"?`,
    { modal: true },
    'Delete'
  );
  if (confirm === 'Delete') {
    if (connectionManager.isConnected(profile.id)) {
      await connectionManager.disconnect(profile.id);
    }
    await storageService.deleteBroker(profile.id);
    brokerTreeProvider.refresh();
    vscode.window.showInformationMessage(`Deleted broker profile "${profile.name}".`);
  }
}

export async function handleConnectBroker(
  item: BrokerTreeItem | undefined,
  storageService: StorageService,
  connectionManager: ConnectionManager,
  extensionUri: vscode.Uri
) {
  let profile = item?.profile;
  if (!profile) {
    const brokers = await storageService.getBrokers();
    if (brokers.length === 0) {
      const addOption = 'Add New Broker';
      const selected = await vscode.window.showInformationMessage(
        'No broker profiles found. Add one to connect.',
        addOption
      );
      if (selected === addOption) {
        vscode.commands.executeCommand('mqtt-code.add-broker');
      }
      return;
    }
    const picked = await vscode.window.showQuickPick(
      brokers.map((b) => ({
        label: b.name,
        description: `${b.protocol}${b.host}:${b.port}`,
        broker: b,
      })),
      { placeHolder: 'Select broker to connect' }
    );
    if (!picked) {
      return;
    }
    profile = picked.broker;
  }

  try {
    await connectionManager.connect(profile);
    const config = vscode.workspace.getConfiguration('mqttCode');
    if (config.get<boolean>('autoOpenExplorerOnConnect', true)) {
      ExplorerPanel.createOrShow(extensionUri, connectionManager, profile.id, storageService);
    }
    vscode.window.showInformationMessage(`Connected to MQTT broker "${profile.name}".`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to connect to "${profile.name}": ${msg}`);
  }
}
