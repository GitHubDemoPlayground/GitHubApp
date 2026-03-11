import * as core from '@actions/core';

export interface SourceRepo {
  owner: string;
  repo: string;
  path: string;
  targetPath: string;
}

export interface Config {
  appId: string;
  privateKey: string;
  sourceRepos: SourceRepo[];
  targetOwner: string;
  targetRepo: string;
  targetBranch: string;
}

export function getConfig(): Config {
  const appId = core.getInput('app-id', { required: true });
  const privateKeyRaw = core.getInput('private-key', { required: true });
  const sourceReposJson = core.getInput('source-repos', { required: true });
  const targetRepoFull = core.getInput('target-repo', { required: true });
  const targetBranch = core.getInput('target-branch') || 'main';

  // Accept both raw PEM and base64-encoded PEM
  const privateKey = privateKeyRaw.includes('-----BEGIN')
    ? privateKeyRaw
    : Buffer.from(privateKeyRaw, 'base64').toString('utf-8');

  // Parse source repos
  let sourceRepos: SourceRepo[];
  try {
    sourceRepos = JSON.parse(sourceReposJson);
  } catch {
    throw new Error(`Invalid JSON in source-repos input: ${sourceReposJson}`);
  }

  if (!Array.isArray(sourceRepos) || sourceRepos.length === 0) {
    throw new Error('source-repos must be a non-empty JSON array');
  }

  for (const sr of sourceRepos) {
    if (!sr.owner || !sr.repo || !sr.path || !sr.targetPath) {
      throw new Error(
        `Each source repo must have owner, repo, path, and targetPath. Got: ${JSON.stringify(sr)}`
      );
    }
  }

  // Parse target repo
  const parts = targetRepoFull.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`target-repo must be in owner/repo format. Got: ${targetRepoFull}`);
  }

  return {
    appId,
    privateKey,
    sourceRepos,
    targetOwner: parts[0],
    targetRepo: parts[1],
    targetBranch,
  };
}
