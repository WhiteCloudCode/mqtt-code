import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  it('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('whitecloudcode.mqtt-code'));
  });

  it('Extension should activate', async () => {
    const ext = vscode.extensions.getExtension('whitecloudcode.mqtt-code');
    assert.ok(ext, 'Extension not found');

    if (!ext.isActive) {
      await ext.activate();
    }

    assert.ok(ext.isActive, 'Extension should be activated');
  });

  it('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);

    const mqttCommands = [
      'mqtt-code.add-broker',
      'mqtt-code.edit-broker',
      'mqtt-code.delete-broker',
      'mqtt-code.connect-broker',
      'mqtt-code.disconnect-broker',
      'mqtt-code.open-explorer',
      'mqtt-code.add-subscription',
      'mqtt-code.edit-subscription',
      'mqtt-code.remove-subscription',
      'mqtt-code.quick-publish',
      'mqtt-code.refresh-brokers',
    ];

    for (const cmd of mqttCommands) {
      assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
    }
  });
});
