import { Octokit } from '@octokit/rest';
import * as core from '@actions/core';
import { SyncedFile } from './sync';

interface TreeEntry {
  path: string;
  mode: '100644' | '100755' | '040000' | '160000' | '120000';
  type: 'blob' | 'tree' | 'commit';
  sha: string;
}

/**
 * Creates or updates a PR in the target repo with the synced files.
 * If an open sync PR already exists for the same prefix, it updates that PR instead.
 */
export async function createOrUpdateSyncPR(
  octokit: Octokit,
  targetOwner: string,
  targetRepo: string,
  targetBranch: string,
  files: SyncedFile[],
  sourceLabel: string
): Promise<string> {
  if (files.length === 0) {
    core.info('No files to sync. Skipping PR creation.');
    return '';
  }

  const sanitizedLabel = sourceLabel
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
  const branchPrefix = `sync/${sanitizedLabel}`;
  const timestamp = Date.now();
  const newBranchName = `${branchPrefix}-${timestamp}`;

  core.info(`Creating sync branch: ${newBranchName}`);

  // 1. Get the latest commit on the target branch
  const { data: refData } = await octokit.rest.git.getRef({
    owner: targetOwner,
    repo: targetRepo,
    ref: `heads/${targetBranch}`,
  });
  const baseSha = refData.object.sha;

  // 2. Check for existing open sync PRs with the same prefix
  const { data: existingPRs } = await octokit.rest.pulls.list({
    owner: targetOwner,
    repo: targetRepo,
    state: 'open',
    head: `${targetOwner}:${branchPrefix}`,
  });

  // Find a PR whose head branch starts with our prefix
  const existingPR = existingPRs.find((pr) => pr.head.ref.startsWith(branchPrefix));

  let headBranch: string;
  let baseCommitSha: string;

  if (existingPR) {
    // Update the existing PR branch
    headBranch = existingPR.head.ref;
    baseCommitSha = existingPR.head.sha;
    core.info(`Found existing sync PR #${existingPR.number} on branch ${headBranch}. Updating...`);
  } else {
    // Create a new branch
    headBranch = newBranchName;
    baseCommitSha = baseSha;

    await octokit.rest.git.createRef({
      owner: targetOwner,
      repo: targetRepo,
      ref: `refs/heads/${headBranch}`,
      sha: baseSha,
    });
    core.info(`Created branch ${headBranch} from ${targetBranch} (${baseSha.substring(0, 7)})`);
  }

  // 3. Create blobs for each file
  const treeEntries: TreeEntry[] = [];
  for (const file of files) {
    const { data: blob } = await octokit.rest.git.createBlob({
      owner: targetOwner,
      repo: targetRepo,
      content: file.content,
      encoding: file.encoding,
    });

    treeEntries.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    });
  }

  // 4. Create a new tree
  const { data: tree } = await octokit.rest.git.createTree({
    owner: targetOwner,
    repo: targetRepo,
    base_tree: baseCommitSha,
    tree: treeEntries,
  });

  // 5. Create a commit
  const commitMessage = existingPR
    ? `chore: update synced components from ${sourceLabel}`
    : `chore: sync components from ${sourceLabel}`;

  const { data: commit } = await octokit.rest.git.createCommit({
    owner: targetOwner,
    repo: targetRepo,
    message: commitMessage,
    tree: tree.sha,
    parents: [baseCommitSha],
  });

  // 6. Update the branch ref to point to the new commit
  await octokit.rest.git.updateRef({
    owner: targetOwner,
    repo: targetRepo,
    ref: `heads/${headBranch}`,
    sha: commit.sha,
  });

  core.info(`Committed ${files.length} files (${commit.sha.substring(0, 7)})`);

  // 7. Create or update the PR
  if (existingPR) {
    await octokit.rest.pulls.update({
      owner: targetOwner,
      repo: targetRepo,
      pull_number: existingPR.number,
      body: buildPRBody(files, sourceLabel, new Date()),
    });
    const prUrl = existingPR.html_url;
    core.info(`Updated existing PR #${existingPR.number}: ${prUrl}`);
    return prUrl;
  } else {
    const { data: pr } = await octokit.rest.pulls.create({
      owner: targetOwner,
      repo: targetRepo,
      title: `chore: sync components from ${sourceLabel}`,
      head: headBranch,
      base: targetBranch,
      body: buildPRBody(files, sourceLabel, new Date()),
    });
    core.info(`Created PR #${pr.number}: ${pr.html_url}`);
    return pr.html_url;
  }
}

function buildPRBody(files: SyncedFile[], source: string, date: Date): string {
  const fileList = files.map((f) => `- \`${f.path}\``).join('\n');
  return [
    `## Component Sync from \`${source}\``,
    '',
    `**Synced at:** ${date.toISOString()}`,
    '',
    `### Files synced (${files.length}):`,
    fileList,
    '',
    '---',
    '*This PR was automatically created by the Component Sync GitHub App.*',
  ].join('\n');
}
