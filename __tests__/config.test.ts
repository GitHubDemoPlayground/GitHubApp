import { getConfig, SourceRepo } from '../src/config';
import * as core from '@actions/core';

// Mock @actions/core
jest.mock('@actions/core');

const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>;

describe('config', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const validSourceRepos: SourceRepo[] = [
    { owner: 'my-org', repo: 'repo-a', path: 'src/components', targetPath: 'components/repo-a' },
    { owner: 'my-org', repo: 'repo-b', path: 'src/shared', targetPath: 'components/repo-b' },
  ];

  function setupMocks(overrides: Record<string, string> = {}): void {
    const defaults: Record<string, string> = {
      'app-id': '12345',
      'private-key': Buffer.from('fake-private-key').toString('base64'),
      'source-repos': JSON.stringify(validSourceRepos),
      'target-repo': 'my-org/repo-c',
      'target-branch': 'main',
    };
    const merged = { ...defaults, ...overrides };

    mockGetInput.mockImplementation((name: string) => merged[name] || '');
  }

  it('should parse valid configuration', () => {
    setupMocks();
    const config = getConfig();

    expect(config.appId).toBe('12345');
    expect(config.privateKey).toBe('fake-private-key');
    expect(config.sourceRepos).toHaveLength(2);
    expect(config.sourceRepos[0].owner).toBe('my-org');
    expect(config.sourceRepos[0].repo).toBe('repo-a');
    expect(config.targetOwner).toBe('my-org');
    expect(config.targetRepo).toBe('repo-c');
    expect(config.targetBranch).toBe('main');
  });

  it('should throw on invalid JSON in source-repos', () => {
    setupMocks({ 'source-repos': 'not-json' });
    expect(() => getConfig()).toThrow('Invalid JSON');
  });

  it('should throw on empty source-repos array', () => {
    setupMocks({ 'source-repos': '[]' });
    expect(() => getConfig()).toThrow('non-empty JSON array');
  });

  it('should throw on invalid target-repo format', () => {
    setupMocks({ 'target-repo': 'invalid-format' });
    expect(() => getConfig()).toThrow('owner/repo format');
  });

  it('should throw when source repo entry is missing fields', () => {
    setupMocks({ 'source-repos': JSON.stringify([{ owner: 'org', repo: 'repo' }]) });
    expect(() => getConfig()).toThrow('must have owner, repo, path, and targetPath');
  });
});
