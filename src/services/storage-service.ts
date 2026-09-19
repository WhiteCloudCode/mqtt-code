import * as vscode from 'vscode';
import { BrokerProfile } from '../models/broker-profile';

const STORAGE_KEY_BROKERS = 'mqtt-code.brokers';
const SECRET_PREFIX_PASSWORD = 'mqtt-code.secret.password.';

export class StorageService {
  private readonly globalState: vscode.Memento;
  private readonly secrets: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this.globalState = context.globalState;
    this.secrets = context.secrets;
  }

  public async getBrokers(): Promise<BrokerProfile[]> {
    const rawBrokers = this.globalState.get<BrokerProfile[]>(STORAGE_KEY_BROKERS, []);
    return rawBrokers;
  }

  public async getBroker(id: string): Promise<BrokerProfile | undefined> {
    const brokers = await this.getBrokers();
    return brokers.find((b) => b.id === id);
  }

  public async saveBroker(profile: BrokerProfile, password?: string): Promise<void> {
    const brokers = await this.getBrokers();
    const existingIndex = brokers.findIndex((b) => b.id === profile.id);

    if (password !== undefined) {
      if (password.length > 0) {
        await this.secrets.store(`${SECRET_PREFIX_PASSWORD}${profile.id}`, password);
        profile.hasPassword = true;
      } else {
        await this.secrets.delete(`${SECRET_PREFIX_PASSWORD}${profile.id}`);
        profile.hasPassword = false;
      }
    }

    if (existingIndex >= 0) {
      brokers[existingIndex] = profile;
    } else {
      brokers.push(profile);
    }

    await this.globalState.update(STORAGE_KEY_BROKERS, brokers);
  }

  public async deleteBroker(id: string): Promise<void> {
    const brokers = await this.getBrokers();
    const filteredBrokers = brokers.filter((b) => b.id !== id);
    await this.globalState.update(STORAGE_KEY_BROKERS, filteredBrokers);
    await this.secrets.delete(`${SECRET_PREFIX_PASSWORD}${id}`);
  }

  public async getBrokerPassword(id: string): Promise<string | undefined> {
    return await this.secrets.get(`${SECRET_PREFIX_PASSWORD}${id}`);
  }

  public async saveBrokerSubscriptions(id: string, subscriptions: string[]): Promise<void> {
    const broker = await this.getBroker(id);
    if (broker) {
      broker.subscriptions = subscriptions;
      await this.saveBroker(broker);
    }
  }

  public getPublisherOpenState(): boolean {
    return this.globalState.get<boolean>('mqtt-code.ui.publisherOpen', true);
  }

  public async setPublisherOpenState(isOpen: boolean): Promise<void> {
    await this.globalState.update('mqtt-code.ui.publisherOpen', isOpen);
  }

  public getTopicPaneWidth(): string | undefined {
    return this.globalState.get<string>('mqtt-code.ui.topicPaneWidth');
  }

  public async setTopicPaneWidth(width: string): Promise<void> {
    await this.globalState.update('mqtt-code.ui.topicPaneWidth', width);
  }
}
