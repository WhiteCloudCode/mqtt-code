import * as assert from 'assert';
import { StorageService } from '../../services/storage-service';
import { BrokerProfile } from '../../models/broker-profile';

class MockMemento {
  private storage = new Map<string, unknown>();
  keys(): readonly string[] {
    return Array.from(this.storage.keys());
  }
  get<T>(key: string, defaultValue?: T): T {
    return (this.storage.has(key) ? this.storage.get(key) : defaultValue) as T;
  }
  update(key: string, value: unknown): Promise<void> {
    this.storage.set(key, value);
    return Promise.resolve();
  }
  setKeysForSync(): void {}
}

class MockSecretStorage {
  private secrets = new Map<string, string>();
  onDidChange = (() => {
    return { dispose: () => {} };
  }) as unknown;
  get(key: string): Promise<string | undefined> {
    return Promise.resolve(this.secrets.get(key));
  }
  store(key: string, value: string): Promise<void> {
    this.secrets.set(key, value);
    return Promise.resolve();
  }
  delete(key: string): Promise<void> {
    this.secrets.delete(key);
    return Promise.resolve();
  }
}

describe('StorageService', () => {
  let globalState: MockMemento;
  let secrets: MockSecretStorage;
  let storageService: StorageService;

  beforeEach(() => {
    globalState = new MockMemento();
    secrets = new MockSecretStorage();
    storageService = new StorageService({
      globalState,
      secrets,
    } as unknown as import('vscode').ExtensionContext);
  });

  it('should save and retrieve a broker profile', async () => {
    const profile: BrokerProfile = {
      id: 'test-id',
      name: 'Test Broker',
      host: 'localhost',
      port: 1883,
      protocol: 'mqtt://',
      createdAt: Date.now(),
    };

    await storageService.saveBroker(profile);
    const brokers = await storageService.getBrokers();

    assert.strictEqual(brokers.length, 1);
    assert.strictEqual(brokers[0].name, 'Test Broker');

    const fetched = await storageService.getBroker('test-id');
    assert.ok(fetched);
    assert.strictEqual(fetched.id, 'test-id');
  });

  it('should store password securely and mark hasPassword', async () => {
    const profile: BrokerProfile = {
      id: 'test-pw-id',
      name: 'Secure Broker',
      host: 'localhost',
      port: 1883,
      protocol: 'mqtt://',
      createdAt: Date.now(),
    };

    await storageService.saveBroker(profile, 'super_secret');

    const brokers = await storageService.getBrokers();
    assert.strictEqual(brokers[0].hasPassword, true);

    const password = await storageService.getBrokerPassword('test-pw-id');
    assert.strictEqual(password, 'super_secret');
  });

  it('should delete a broker and its password', async () => {
    const profile: BrokerProfile = {
      id: 'test-del-id',
      name: 'Temp Broker',
      host: 'localhost',
      port: 1883,
      protocol: 'mqtt://',
      createdAt: Date.now(),
    };

    await storageService.saveBroker(profile, 'pass123');
    await storageService.deleteBroker('test-del-id');

    const brokers = await storageService.getBrokers();
    assert.strictEqual(brokers.length, 0);

    const password = await storageService.getBrokerPassword('test-del-id');
    assert.strictEqual(password, undefined);
  });
});
