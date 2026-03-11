import { Octokit } from '@octokit/rest';
import * as core from '@actions/core';
import { SourceRepo } from './config';

export interface SyncedFile {
  path: string;
  content: string;
  encoding: string;
}

/**
 * Fetches all files from a directory in a source repo using the Git Trees API.
 * Returns a flat list of files with their content, mapped to the target path.
 */
export async function fetchDirectoryContents(
  octokit: Octokit,
  source: SourceRepo,
  ref: string = 'HEAD'
): Promise<SyncedFile[]> {
  const { owner, repo, path: sourcePath, targetPath } = source;

  core.info(`Fetching tree for ${owner}/${repo} at ref ${ref}...`);

  // Get the commit SHA for the ref
  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${ref === 'HEAD' ? 'main' : ref}`,
  });
  const commitSha = refData.object.sha;

  // Get the commit to find the tree SHA
  const { data: commitData } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  });

  // Get the full tree recursively
  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: commitData.tree.sha,
    recursive: 'true',
  });

  if (tree.truncated) {
    core.warning(`Tree was truncated for ${owner}/${repo}. Some files may be missing.`);
  }

  // Filter to only files under the source path
  const normalizedPath = sourcePath.replace(/\/$/, '');
  const matchingEntries = tree.tree.filter(
    (entry) =>
      entry.path?.startsWith(`${normalizedPath}/`) &&
      entry.type === 'blob' &&
      entry.sha
  );

  core.info(`Found ${matchingEntries.length} files under ${normalizedPath} in ${owner}/${repo}`);

  // Fetch content for each file
  const files: SyncedFile[] = [];
  for (const entry of matchingEntries) {
    if (!entry.sha || !entry.path) continue;

    const { data: blob } = await octokit.rest.git.getBlob({
      owner,
      repo,
      file_sha: entry.sha,
    });

    // Map source path to target path
    const relativePath = entry.path.substring(normalizedPath.length + 1);
    const mappedPath = `${targetPath}/${relativePath}`;

    files.push({
      path: mappedPath,
      content: blob.content,
      encoding: blob.encoding,
    });
  }

  return files;
}

/**
 * Fetches components from all source repos.
 */
export async function fetchAllSources(
  octokit: Octokit,
  sources: SourceRepo[]
): Promise<SyncedFile[]> {
  const allFiles: SyncedFile[] = [];

  for (const source of sources) {
    core.info(`\nSyncing ${source.owner}/${source.repo}:${source.path} → ${source.targetPath}`);
    const files = await fetchDirectoryContents(octokit, source);
    allFiles.push(...files);
    core.info(`  Fetched ${files.length} files`);
  }

  return allFiles;
}
