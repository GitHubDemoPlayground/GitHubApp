import { Octokit } from '@octokit/rest';
import { SyncedFile } from './sync';
/**
 * Creates or updates a PR in the target repo with the synced files.
 * If an open sync PR already exists for the same prefix, it updates that PR instead.
 */
export declare function createOrUpdateSyncPR(octokit: Octokit, targetOwner: string, targetRepo: string, targetBranch: string, files: SyncedFile[], sourceLabel: string): Promise<string>;
