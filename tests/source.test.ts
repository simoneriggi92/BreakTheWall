import { describe, expect, it } from 'vitest';
import { buildGenerationInput, formatSource } from '../src/core/generation';
import { hashText } from '../src/core/lesson';
import { checkSelection, importSource, SOURCE_LIMITS, SourceImportError, verifySelection, type ImportInput } from '../src/core/source';

const bytes = (value: string) => new TextEncoder().encode(value);
async function code(input: ImportInput) {
  try { await importSource(input); return 'accepted'; }
  catch (error) { expect(error).toBeInstanceOf(SourceImportError); return (error as SourceImportError).code; }
}

describe('source import (T4)', () => {
  it('imports pasted text and pasted code as exact, hashed source records', async () => {
    const text = await importSource({ kind: 'paste', title: '  Note  ', text: 'Uno\r\nDue\rTre\n\n' });
    expect(text).toMatchObject({ title: 'Note', origin: 'user-pasted', revision: 'v1', text: 'Uno\nDue\nTre' });
    expect(text.sha256).toBe(await hashText('Uno\nDue\nTre'));
    expect(text.id).toBe(`src-${text.sha256.slice(0, 12)}`);
    const code = await importSource({ kind: 'paste', title: 'retry.ts', text: 'export function retry() {\n\treturn 1;\n}', language: 'TypeScript' });
    expect(code).toMatchObject({ language: 'TypeScript', text: 'export function retry() {\n\treturn 1;\n}' });
  });

  it('imports UTF-8 .txt and .md files, dropping a byte-order mark and unifying line endings', async () => {
    const md = await importSource({ kind: 'file', name: 'Ciclo.MD', bytes: bytes('﻿# Titolo\r\nàèìòù — ✓') });
    expect(md).toMatchObject({ title: 'Ciclo.MD', origin: 'user-file', text: '# Titolo\nàèìòù — ✓' });
    expect((await importSource({ kind: 'file', name: 'note.txt', bytes: bytes('ciao') })).text).toBe('ciao');
  });

  it('rejects empty, non-UTF-8, binary, unsupported and over-limit input before it can become a lesson', async () => {
    expect(await code({ kind: 'paste', title: 'x', text: '  \n\t ' })).toBe('empty');
    expect(await code({ kind: 'file', name: 'empty.txt', bytes: new Uint8Array() })).toBe('empty');
    expect(await code({ kind: 'paste', title: '', text: 'testo' })).toBe('missing-title');
    expect(await code({ kind: 'file', name: 'latin1.txt', bytes: new Uint8Array([0x63, 0x61, 0x66, 0xe8]) })).toBe('not-utf8');
    expect(await code({ kind: 'file', name: 'image.txt', bytes: new Uint8Array([0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]) })).toBe('binary');
    expect(await code({ kind: 'file', name: 'paper.pdf', bytes: bytes('%PDF-1.7') })).toBe('unsupported-type');
    expect(await code({ kind: 'file', name: 'main.ts', bytes: bytes('let a = 1') })).toBe('unsupported-type');
    expect(await code({ kind: 'file', name: 'README', bytes: bytes('x') })).toBe('unsupported-type');
    expect(await code({ kind: 'file', name: 'big.txt', bytes: new Uint8Array(SOURCE_LIMITS.maxFileBytes + 1).fill(97) })).toBe('too-large');
    expect(await code({ kind: 'paste', title: 'x', text: 'a'.repeat(SOURCE_LIMITS.maxCharsPerSource + 1) })).toBe('too-large');
    expect(await code({ kind: 'paste', title: 'x', text: 'a\n'.repeat(SOURCE_LIMITS.maxLines + 1) })).toBe('too-many-lines');
    expect(await code({ kind: 'paste', title: 'x', text: 'a'.repeat(SOURCE_LIMITS.maxLineChars + 1) })).toBe('line-too-long');
  });

  it('bounds the whole selection: count, duplicates and total size', async () => {
    const make = (i: number, size = 10) => importSource({ kind: 'paste', title: `s${i}`, text: `${i}`.padEnd(size, '.').replace(/(.{100})/g, '$1\n') });
    const four = await Promise.all([1, 2, 3, 4].map(i => make(i)));
    expect(() => checkSelection(four)).not.toThrow();
    const fifth = await make(5);
    expect(() => checkSelection([...four, fifth])).toThrow(/al massimo 4/);
    expect(() => checkSelection([four[0], four[0]])).toThrow(/già nella selezione/);
    const big = await Promise.all([1, 2].map(i => make(i, SOURCE_LIMITS.maxTotalChars / 2)));
    expect(() => checkSelection(big)).toThrow(/limite per un percorso/);
  });

  it('has the host re-verify renderer-supplied sources: edited text, prepared origin and bounds are refused', async () => {
    const source = await importSource({ kind: 'paste', title: 'Note', text: 'Uno\nDue' });
    await expect(verifySelection([source])).resolves.toHaveLength(1);
    await expect(verifySelection([{ ...source, text: 'Uno\nTre' }])).rejects.toMatchObject({ code: 'mismatch' });
    await expect(verifySelection([{ ...source, origin: 'original-prepared' }])).rejects.toMatchObject({ code: 'unsupported-type' });
    await expect(verifySelection([])).rejects.toThrow();
  });

  it('sends exactly the previewed text: every line, numbered as in the preview, plus the goal and nothing else', async () => {
    const a = await importSource({ kind: 'paste', title: 'A', text: 'prima\n\nterza  ' });
    const b = await importSource({ kind: 'paste', title: 'B "quoted"', text: 'if (x) {\n  run();\n}', language: 'JavaScript' });
    const input = buildGenerationInput([a, b], { outcome: 'Spiegare il flusso', priorKnowledge: '' });
    const lines = input.split('\n');
    expect(lines.slice(0, 3)).toEqual(['OBIETTIVO DI APPRENDIMENTO: Spiegare il flusso', 'CONOSCENZE DI PARTENZA: non indicate', '']);
    expect(input).toContain(formatSource(a));
    expect(formatSource(a).split('\n').slice(1, -1)).toEqual(['1| prima', '2| ', '3| terza']);
    expect(formatSource(b).split('\n').slice(1, -1).map(l => l.slice(l.indexOf('| ') + 2))).toEqual(b.text.split('\n'));
    expect(formatSource(b).split('\n')[0]).toBe(`<<<FONTE id="${b.id}" titolo="B \\"quoted\\"" righe=3 linguaggio="JavaScript">>>`);
  });
});
