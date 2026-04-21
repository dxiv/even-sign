import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

describe('Even Hub: typing + speech (shipped UI contract)', () => {
  it('exposes a normal editable textarea for phrase entry', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).toMatch(/<textarea[\s\S]*?id="ev-sign-input"[\s\S]*?<\/textarea>/);
    expect(html).not.toMatch(/id="ev-sign-input"[^>]*\breadonly\b/);
    expect(html).not.toMatch(/id="ev-sign-input"[^>]*\bdisabled\b/);
  });

  it('keeps Speak on Web Speech API without gating on Even bridge presence', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'evenSignPage.ts'), 'utf8');
    expect(src).toContain('getSpeechRecognition');
    expect(src).toContain('window.SpeechRecognition ?? window.webkitSpeechRecognition');
    expect(src).toContain("getElementById('ev-sign-speak')");
    expect(src).toContain('rec.start()');
    const speakIdx = src.indexOf("btnSpeak?.addEventListener('click'");
    expect(speakIdx).toBeGreaterThanOrEqual(0);
    const bridgeIdx = src.indexOf('const { bridge, bridgeAbsentReason }');
    expect(speakIdx).toBeGreaterThan(bridgeIdx);
    const slice = src.slice(speakIdx, speakIdx + 800);
    expect(slice).not.toMatch(/bridgeAbsentReason[\s\S]{0,400}getSpeechRecognition/);
    expect(slice).not.toMatch(/if\s*\(\s*!bridge[\s\S]{0,400}getSpeechRecognition/);
  });

  it('does not force browser-only unless ?pc is present (Hub gets bridge wait)', () => {
    const main = fs.readFileSync(path.join(ROOT, 'src', 'main.ts'), 'utf8');
    expect(main).toContain("URLSearchParams(window.location.search).has('pc')");
  });
});
