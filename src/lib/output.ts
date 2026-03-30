import type { JsonOutput } from '../types.js';

let jsonMode = false;

export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

export function out(text: string, data?: unknown): void {
  if (jsonMode && data !== undefined) {
    const output: JsonOutput = { ok: true, data };
    console.log(JSON.stringify(output));
  } else if (jsonMode) {
    const output: JsonOutput = { ok: true, data: text };
    console.log(JSON.stringify(output));
  } else {
    console.log(text);
  }
}

export function err(message: string): void {
  if (jsonMode) {
    const output: JsonOutput = { ok: false, error: message };
    console.log(JSON.stringify(output));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exitCode = 1;
}

export function mask(token: string): string {
  if (token.length <= 6) return '***';
  return token.substring(0, 4) + '***' + token.substring(token.length - 3);
}
