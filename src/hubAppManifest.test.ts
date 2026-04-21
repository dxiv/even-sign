import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

type HubPermission = { name: string; desc: string; whitelist?: string[] };

describe('app.json Hub manifest', () => {
  it('declares microphone and optional speech network permissions', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8');
    const app = JSON.parse(raw) as { permissions: HubPermission[] };
    expect(Array.isArray(app.permissions)).toBe(true);

    const mic = app.permissions.find((p) => p.name === 'phone-microphone');
    expect(mic).toBeDefined();
    expect(mic!.desc.length).toBeGreaterThanOrEqual(1);
    expect(mic!.desc.length).toBeLessThanOrEqual(300);

    const net = app.permissions.find((p) => p.name === 'network');
    expect(net).toBeDefined();
    expect(net!.desc.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(net!.whitelist)).toBe(true);
    expect(net!.whitelist!.length).toBeGreaterThan(0);
    for (const u of net!.whitelist!) {
      expect(u).toMatch(/^https:\/\//);
    }
  });
});
