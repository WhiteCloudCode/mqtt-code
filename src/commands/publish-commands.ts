import * as vscode from 'vscode';
import { ConnectionManager } from '../services/connection-manager';

export async function handleQuickPublish(connectionManager: ConnectionManager) {
  const connectedBrokers = connectionManager.getConnectedBrokers();
  if (connectedBrokers.length === 0) {
    vscode.window.showWarningMessage('Please connect to an MQTT broker before publishing.');
    return;
  }

  let brokerId = connectedBrokers[0].id;
  if (connectedBrokers.length > 1) {
    const picked = await vscode.window.showQuickPick(
      connectedBrokers.map((b) => ({
        label: b.name,
        description: `${b.host}:${b.port}`,
        brokerId: b.id,
      })),
      { placeHolder: 'Select broker to publish to' }
    );
    if (!picked) {
      return;
    }
    brokerId = picked.brokerId;
  }

  const topic = await vscode.window.showInputBox({
    prompt: 'Enter destination topic for publishing',
    placeHolder: 'e.g. test/topic',
    validateInput: (val) => (val.trim().length === 0 ? 'Topic cannot be empty' : null),
  });
  if (!topic) {
    return;
  }

  const payload = await vscode.window.showInputBox({
    prompt: 'Enter message payload (text or JSON)',
    placeHolder: 'e.g. {"status": "ok"}',
    value: 'Hello from MQTT Code!',
  });
  if (payload === undefined) {
    return;
  }

  const qosPick = await vscode.window.showQuickPick(
    [
      { label: '0', description: 'At most once' },
      { label: '1', description: 'At least once' },
      { label: '2', description: 'Exactly once' },
    ],
    { placeHolder: 'Select publish QoS level' }
  );
  const qos = (qosPick ? Number.parseInt(qosPick.label, 10) : 0) as 0 | 1 | 2;

  const retainPick = await vscode.window.showQuickPick(
    [
      { label: 'No', description: 'Do not retain message' },
      { label: 'Yes', description: 'Retain message on broker' },
    ],
    { placeHolder: 'Retain message?' }
  );
  const retain = retainPick?.label === 'Yes';

  try {
    await connectionManager.publish(brokerId, {
      topic: topic.trim(),
      payload,
      qos,
      retain,
    });
    vscode.window.showInformationMessage(`Published message to ${topic}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to publish message: ${msg}`);
  }
}
