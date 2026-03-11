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
export declare function getConfig(): Config;
