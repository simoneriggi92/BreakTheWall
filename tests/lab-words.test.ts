import { describe, expect, it } from 'vitest';
import { charsFor } from '../src/renderer/lab/cabinet';
import { wrap } from '../src/renderer/disassembly/Sheet';

// P-20261103-lab-mode L13: a name wraps to its module on screen, but a word is never broken.
describe('names on a module', () => {
  it('wraps to the module and keeps the longest word whole', () => {
    const px = (n: number) => n / 0.6, name = 'Legge l’interruttore';
    expect(wrap(name, charsFor(name, 150, px, 12), 3)).toEqual(['Legge', 'l’interruttore']);
    expect(charsFor('Fetch', 150, px, 12)).toBe(12);
  });
});
