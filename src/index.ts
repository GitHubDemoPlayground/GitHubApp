import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { getConfig } from './config';
import { fetchAllSources } from './sync';
import { createOrUpdateSyncPR } from './pr';

async function run(): Promise<void> {
  try {
    const config = getConfig();

    core.info('Authenticating as GitHub App...');

    // Create an Octokit instance authenticated as the GitHub App installation
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: config.appId,
        privateKey: config.privateKey,
      },
    });

    // Find the installation for the target repo's owner (org)
    const { data: installation } = await appOctokit.rest.apps.getOrgInstallation({
      org: config.targetOwner,
    });

    core.info(`Found installation ${installation.id} for org ${config.targetOwner}`);

    // Create an Octokit authenticated as the installation
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: config.appId,
        privateKey: config.privateKey,
        installationId: installation.id,
      },
    });

    // Fetch all source files
    core.info('\n=== Fetching components from source repos ===');
    const files = await fetchAllSources(octokit, config.sourceRepos);

    if (files.length === 0) {
      core.warning('No files found in any source repos. Nothing to sync.');
      return;
    }

    core.info(`\nTotal files to sync: ${files.length}`);

    // Build a label from all source repos for the PR
    const sourceLabel = config.sourceRepos
      .map((s) => `${s.owner}/${s.repo}`)
      .join(', ');

    // Create or update the sync PR
    core.info('\n=== Creating/updating sync PR ===');
    const prUrl = await createOrUpdateSyncPR(
      octokit,
      config.targetOwner,
      config.targetRepo,
      config.targetBranch,
      files,
      sourceLabel
    );

    if (prUrl) {
      core.setOutput('pr-url', prUrl);
      core.info(`\nSync complete! PR: ${prUrl}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
