import * as vscode from 'vscode';

export class LogService {
  private static instance: LogService | undefined;
  private readonly outputChannel: vscode.OutputChannel;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('MQTT Code');
  }

  public static getInstance(): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService();
    }
    return LogService.instance;
  }

  public info(message: string): void {
    this.log('INFO', message);
  }

  public warn(message: string): void {
    this.log('WARN', message);
  }

  public error(message: string, error?: unknown): void {
    let details = message;
    if (error instanceof Error) {
      details += ` - ${error.message}\n${error.stack || ''}`;
    } else if (error) {
      details += ` - ${String(error)}`;
    }
    this.log('ERROR', details);
  }

  public debug(message: string): void {
    this.log('DEBUG', message);
  }

  public show(): void {
    this.outputChannel.show(true);
  }

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`);
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}
