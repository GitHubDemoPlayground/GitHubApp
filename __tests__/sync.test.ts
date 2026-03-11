import { fetchDirectoryContents } from '../src/sync';
import { SourceRepo } from '../src/config';

// Mock Octokit instance
function createMockOctokit(files: Array<{ path: string; content: string }>) {
  const blobs = new Map<string, { content: string; encoding: string }>();
  const treeEntries = files.map((f, i) => {
    const sha = `blob-sha-${i}`;
    blobs.set(sha, { content: Buffer.from(f.content).toString('base64'), encoding: 'base64' });
    return { path: f.path, type: 'blob', sha, size: f.content.length, mode: '100644', url: '' };
  });

  return {
    rest: {
      git: {
        getRef: jest.fn().mockResolvedValue({
          data: { object: { sha: 'commit-sha-abc123' } },
        }),
        getCommit: jest.fn().mockResolvedValue({
          data: { tree: { sha: 'tree-sha-abc123' } },
        }),
        getTree: jest.fn().mockResolvedValue({
          data: {
            sha: 'tree-sha-abc123',
            tree: treeEntries,
            truncated: false,
          },
        }),
        getBlob: jest.fn().mockImplementation(({ file_sha }: { file_sha: string }) => {
          const blob = blobs.get(file_sha);
          return Promise.resolve({ data: blob });
        }),
      },
    },
  } as any;
}

describe('sync', () => {
  const source: SourceRepo = {
    owner: 'my-org',
    repo: 'repo-a',
    path: 'src/components',
    targetPath: 'components/repo-a',
  };

  it('should fetch and map files from source to target path', async () => {
    const mockOctokit = createMockOctokit([
      { path: 'src/components/Button.tsx', content: 'export const Button = () => {}' },
      { path: 'src/components/Input.tsx', content: 'export const Input = () => {}' },
      { path: 'src/other/utils.ts', content: 'should be excluded' },
    ]);

    const files = await fetchDirectoryContents(mockOctokit, source);

    expect(files).toHaveLength(2);
    expect(files[0].path).toBe('components/repo-a/Button.tsx');
    expect(files[1].path).toBe('components/repo-a/Input.tsx');
  });

  it('should return empty array when no files match the path', async () => {
    const mockOctokit = createMockOctokit([
      { path: 'src/other/utils.ts', content: 'no match' },
    ]);

    const files = await fetchDirectoryContents(mockOctokit, source);
    expect(files).toHaveLength(0);
  });

  it('should handle nested directories', async () => {
    const mockOctokit = createMockOctokit([
      { path: 'src/components/ui/Dialog.tsx', content: 'export const Dialog = () => {}' },
      { path: 'src/components/ui/forms/Select.tsx', content: 'export const Select = () => {}' },
    ]);

    const files = await fetchDirectoryContents(mockOctokit, source);

    expect(files).toHaveLength(2);
    expect(files[0].path).toBe('components/repo-a/ui/Dialog.tsx');
    expect(files[1].path).toBe('components/repo-a/ui/forms/Select.tsx');
  });
});
