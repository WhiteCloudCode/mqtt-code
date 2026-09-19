import * as assert from 'assert';
import { ConnectionManager } from '../../services/connection-manager';
import { BrokerProfile } from '../../models/broker-profile';

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockStorageService: unknown;

  beforeEach(() => {
    mockStorageService = {
      getBrokerPassword: async () => 'secret_password',
      saveBrokerSubscriptions: async () => {},
    };

    connectionManager = new ConnectionManager(
      mockStorageService as unknown as import('../../services/storage-service').StorageService
    );
  });

  afterEach(async () => {
    // Cleanup any ongoing connections
    const brokers = connectionManager.getConnectedBrokers();
    for (const b of brokers) {
      await connectionManager.disconnect(b.id);
    }
  });

  it('should attempt connection and update status to connecting', async () => {
    const broker: BrokerProfile = {
      id: 'test-broker-1',
      name: 'Local test',
      host: '127.0.0.1',
      port: 59999, // Unlikely to be used
      protocol: 'mqtt://',
      createdAt: Date.now(),
    };

    // Ignore potential errors from ECONNREFUSED
    try {
      await connectionManager.connect(broker);
    } catch {
      /* ignore */
    }

    // As it tries to connect, status is 'connecting'
    assert.strictEqual(connectionManager.getConnectionStatus('test-broker-1').state, 'connecting');

    // Check TopicTreeManager is initialised
    const ttm = connectionManager.getTopicTreeManager('test-broker-1');
    assert.ok(ttm);
  });

  it('should disconnect and update status', async () => {
    const broker: BrokerProfile = {
      id: 'test-broker-2',
      name: 'Local test 2',
      host: '127.0.0.1',
      port: 59999,
      protocol: 'mqtt://',
      createdAt: Date.now(),
    };

    try {
      await connectionManager.connect(broker);
    } catch {
      /* ignore */
    }

    await connectionManager.disconnect('test-broker-2');

    assert.strictEqual(connectionManager.isConnected('test-broker-2'), false);
    assert.strictEqual(
      connectionManager.getConnectionStatus('test-broker-2').state,
      'disconnected'
    );
  });
});
