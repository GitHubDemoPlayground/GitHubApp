import { Octokit } from '@octokit/rest';
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
export declare function fetchDirectoryContents(octokit: Octokit, source: SourceRepo, ref?: string): Promise<SyncedFile[]>;
/**
 * Fetches components from all source repos.
 */
export declare function fetchAllSources(octokit: Octokit, sources: SourceRepo[]): Promise<SyncedFile[]>;
