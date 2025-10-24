import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InitializeParams } from 'vscode-languageserver/node.js';
import type * as types from '../src/types/index.js';

const cssSchemaConstructorSpy = vi.fn();

vi.mock('../src/core/css-schema.js', () => {
  class CssSchemaMock {
    public readonly config: types.IConfig;
    constructor(config: types.IConfig) {
      cssSchemaConstructorSpy(config);
      this.config = config;
    }
  }

  return {
    CssSchema: CssSchemaMock,
  };
});

const createInitParams = (workspaceUris: string[]): InitializeParams =>
  ({
    processId: null,
    capabilities: { workspace: { workspaceFolders: true } },
    workspaceFolders: workspaceUris.map((uri, idx) => ({
      uri,
      name: `ws-${idx}`,
    })),
  } as unknown as InitializeParams);

const createConfig = (overrides: Partial<types.IConfig> = {}): types.IConfig =>
  ({
    sourceUrl: 'https://example.com/styles.css',
    themes: [],
    ...overrides,
  }) as types.IConfig;

describe('ConfigManager', () => {
  let capabilities: typeof import('../src/utils/capability-utils.js')['capabilities'];
  let logger: typeof import('../src/utils/logger.js')['logger'];
  let initConfigManager: typeof import('../src/core/config-manager.js')['initConfigManager'];
  let getConfigManager: typeof import('../src/core/config-manager.js')['getConfigManager'];
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    cssSchemaConstructorSpy.mockClear();

    ({ capabilities } = await import('../src/utils/capability-utils.js'));
    ({ logger } = await import('../src/utils/logger.js'));
    ({ initConfigManager, getConfigManager } = await import('../src/core/config-manager.js'));

    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('derives workspace URIs from initialization params', () => {
    capabilities.set(true, true);
    const params = createInitParams(['file:///workspace-a', 'file:///workspace-b']);
    const { configManager } = initConfigManager(vi.fn(), params);

    expect(configManager.workspaceUris).toEqual([
      'file:///workspace-a',
      'file:///workspace-b',
    ]);
  });

  it('returns null from fetchConfigContainer before load', () => {
    capabilities.set(true, true);
    const params = createInitParams(['file:///workspace-a']);
    const { configManager } = initConfigManager(vi.fn(), params);

    expect(configManager.fetchConfigContainer('file:///workspace-a')).toBeNull();
  });

  it('loads configs and attaches schema instances per workspace', async () => {
    capabilities.set(true, true);
    const [workspaceA, workspaceB] = [
      'file:///workspace-a',
      'file:///workspace-b',
    ];
    const params = createInitParams([workspaceA, workspaceB]);

    const configA = createConfig({ sourceUrl: 'https://example.com/a.css' });
    const fetchConfigMock: types.FetchConfig['fn'] = vi
      .fn()
      .mockImplementation((uri: string) => {
        if (uri === workspaceA) {
          return Promise.resolve({ uri, config: configA });
        }

        return Promise.reject({
          uri,
          err: new Error('Failed to load'),
        } satisfies types.FetchConfig['error']);
      });

    const { configManager } = initConfigManager(fetchConfigMock, params);

    await configManager.load();

    expect(fetchConfigMock).toHaveBeenCalledTimes(2);
    expect(cssSchemaConstructorSpy).toHaveBeenCalledWith(configA);

    const loadedContainer = configManager.fetchConfigContainer(workspaceA);
    expect(loadedContainer).not.toBeNull();
    expect(loadedContainer?.config).toBe(configA);
    expect(loadedContainer?.cssSchema).toBeTruthy();

    expect(configManager.fetchConfigContainer(workspaceB)).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('throws if getConfigManager is used before initialization', () => {
    expect(() => getConfigManager()).toThrow(
      'ConfigManger have not been initialized yet'
    );
  });

  it('returns the same manager instance from getConfigManager after init', () => {
    capabilities.set(true, true);
    const params = createInitParams(['file:///workspace-a']);
    const fetchConfigMock = vi.fn();

    const { configManager } = initConfigManager(fetchConfigMock, params);
    const { configManager: retrieved } = getConfigManager();

    expect(retrieved).toBe(configManager);
  });
});
