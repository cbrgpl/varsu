import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getUriMapper, initUriMapper } from '../src/core/uri-mapper.js';

const createMapper = (workspaceUris: string[]) => {
  initUriMapper(workspaceUris);
  return getUriMapper().uriMapper;
};

describe('UriMapper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks a document and returns its workspace uri', () => {
    const mapper = createMapper([
      'file:///workspace-a',
      'file:///workspace-b',
    ]);
    const docUri = 'file:///workspace-a/src/file.css';

    mapper.trackDocument(docUri);

    expect(mapper.getWorkspaceUri(docUri)).toBe('file:///workspace-a');
  });

  it('prefers the most specific workspace prefix when mapping', () => {
    const mapper = createMapper([
      'file:///workspace',
      'file:///workspace/nested',
    ]);
    const docUri = 'file:///workspace/nested/src/file.css';

    mapper.trackDocument(docUri);

    expect(mapper.getWorkspaceUri(docUri)).toBe('file:///workspace/nested');
  });

  it('ignores documents outside known workspaces', () => {
    const mapper = createMapper(['file:///workspace']);
    const docUri = 'file:///other/doc.css';

    mapper.trackDocument(docUri);

    expect(mapper.getWorkspaceUri(docUri)).toBeNull();
  });

  it('removes cached workspace uri after scheduled timeout', () => {
    const mapper = createMapper(['file:///workspace']);
    const docUri = 'file:///workspace/doc.css';

    mapper.trackDocument(docUri);
    mapper.scheduleRemoval(docUri);

    vi.runOnlyPendingTimers();

    expect(mapper.getWorkspaceUri(docUri)).toBeNull();
  });

  it('cancels scheduled removal when document is retracked', () => {
    const mapper = createMapper(['file:///workspace']);
    const docUri = 'file:///workspace/doc.css';

    mapper.trackDocument(docUri);
    mapper.scheduleRemoval(docUri);

    // reopen the document before the timeout fires; should clear the removal timer
    mapper.trackDocument(docUri);

    vi.runOnlyPendingTimers();

    expect(mapper.getWorkspaceUri(docUri)).toBe('file:///workspace');
  });

  it('no-ops removal scheduling for unknown documents', () => {
    const mapper = createMapper(['file:///workspace']);

    expect(() => mapper.scheduleRemoval('file:///workspace/missing.css')).not.toThrow();
  });
});
