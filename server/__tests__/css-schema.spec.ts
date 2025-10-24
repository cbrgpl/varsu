import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CssSchema } from '../src/core/css-schema.js';
import type { ICssTheme } from '../src/types/index.js';

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    warn: loggerMocks.warn,
    error: loggerMocks.error,
  },
}));

const DEFAULT_URL = 'https://example.com/theme.css';
const DEFAULT_THEMES: ICssTheme[] = [
  { name: 'Light', selector: ':root' },
  { name: 'Dark', selector: '.theme-dark' },
];
const ORIGINAL_FETCH = globalThis.fetch;

interface SchemaOptions {
  css: string;
  waitForVar: string;
  themes?: ICssTheme[];
}

describe('CssSchema', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    loggerMocks.warn.mockReset();
    loggerMocks.error.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  const createSchema = async ({
    css,
    waitForVar,
    themes = DEFAULT_THEMES,
  }: SchemaOptions) => {
    const response: Partial<Response> = {
      status: 200,
      text: () => Promise.resolve(css),
    };
    fetchMock.mockResolvedValueOnce(response as Response);

    const schema = new CssSchema({
      sourceUrl: DEFAULT_URL,
      themes,
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        DEFAULT_URL,
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(AbortSignal),
        })
      );
    });

    await vi.waitFor(() => {
      expect(schema.getVariableDetails(waitForVar)).not.toBeNull();
    });

    return schema;
  };

  it('builds completions with metadata for every theme', async () => {
    const schema = await createSchema({
      css: `
        :root {
          /* @description Base color detail @deprecated Use --color-primary instead */
          --color-base: #111;
          --color-contrast: var(--color-base);
        }

        .theme-dark {
          --color-base: #222;
          --color-contrast: color-mix(in srgb, var(--color-base) 80%, white);
        }
      `,
      waitForVar: '--color-base',
    });

    const completions = schema.getCompletions('color');
    expect(completions).not.toBeNull();

    const base = completions?.find((item) => item.label === '--color-base');
    expect(base).toBeDefined();
    expect(base?.detail).toBe('Base color detail');
    expect(base?.documentation && typeof base.documentation === 'object' && base.documentation !== null && 'value' in base.documentation && base.documentation.value).toContain(
      '[deprecated]: Use --color-primary instead'
    );
    expect(base?.documentation && typeof base.documentation === 'object' && base.documentation !== null && 'value' in base.documentation && base.documentation.value).toMatch(/\*\*`Light:`\*\*/);
    expect(base?.documentation && typeof base.documentation === 'object' && base.documentation !== null && 'value' in base.documentation && base.documentation.value).toMatch(/\*\*`Dark:`\*\*/);
    expect(base?.documentation && typeof base.documentation === 'object' && base.documentation !== null && 'value' in base.documentation && base.documentation.value).toContain('#111');
    expect(base?.documentation && typeof base.documentation === 'object' && base.documentation !== null && 'value' in base.documentation && base.documentation.value).toContain('#222');

    const contrast = completions?.find((item) => item.label === '--color-contrast');
    expect(contrast).toBeDefined();
    expect(contrast?.documentation && typeof contrast.documentation === 'object' && contrast.documentation !== null && 'value' in contrast.documentation && contrast.documentation.value).toContain(
      'var(--color-base)'
    );
    expect(contrast?.documentation && typeof contrast.documentation === 'object' && contrast.documentation !== null && 'value' in contrast.documentation && contrast.documentation.value).toContain('#111');
    expect(contrast?.documentation && typeof contrast.documentation === 'object' && contrast.documentation !== null && 'value' in contrast.documentation && contrast.documentation.value).toContain(
      'color-mix(in srgb, #222 80%, white)'
    );

    expect(loggerMocks.warn).not.toHaveBeenCalled();
    expect(loggerMocks.error).not.toHaveBeenCalled();
  });

  it('returns variable details merged across themes with resolved values', async () => {
    const schema = await createSchema({
      css: `
        :root {
          --color-base: #111;
          --color-contrast: var(--color-base);
        }

        .theme-dark {
          --color-base: #222;
          --color-contrast: color-mix(in srgb, var(--color-base) 80%, white);
        }
      `,
      waitForVar: '--color-contrast',
    });

    const details = schema.getVariableDetails('--color-contrast');
    expect(details).not.toBeNull();
    expect(details?.name).toBe('--color-contrast');
    expect(details?.description).toBeUndefined();
    expect(details?.deprecated).toBe(false);
    expect(details?.themes).toEqual([
      {
        name: 'Light',
        value: '#111',
        originalValue: 'var(--color-base)',
      },
      {
        name: 'Dark',
        value: 'color-mix(in srgb, #222 80%, white)',
        originalValue: 'color-mix(in srgb, var(--color-base) 80%, white)',
      },
    ]);
  });

  it('logs warnings when encountering circular dependencies', async () => {
    const schema = await createSchema({
      css: `
        :root {
          --a: var(--b);
          --b: var(--a);
        }
      `,
      waitForVar: '--a',
      themes: [{ name: 'Root', selector: ':root' }],
    });

    expect(loggerMocks.warn).toHaveBeenCalledTimes(1);
    const warning = loggerMocks.warn.mock.calls[0]?.[0] as Error | undefined;
    expect(warning?.message).toContain('Circular dependency');

    const aDetails = schema.getVariableDetails('--a');
    expect(aDetails).not.toBeNull();
    expect(aDetails?.themes[0]?.value).toBe('var(--b)');

    const bDetails = schema.getVariableDetails('--b');
    expect(bDetails).not.toBeNull();
    expect(bDetails?.themes[0]?.value).toBe('var(--b)');
  });
});
