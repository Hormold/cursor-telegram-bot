// Base types
export interface CursorApiResponse<T> {
  data?: T;
  error?: string;
  success?: boolean;
}

// Supported AI models
export enum SupportedModel {
  CLAUDE_4_SONNET_THINKING = 'claude-4-sonnet-thinking',
  O3 = 'o3'
}

// Repository types
export interface Repository {
  installationId: string;
  repoNodeId: string;
  owner: string;
  name: string;
  htmlUrl: string;
  settings: Record<string, any>;
}

export interface Installation {
  installationId: string;
  repos: Repository[];
  settings: {
    suppressNoBugsComments?: boolean;
  };
  canModify: boolean;
  hasMoreRepos: boolean;
  totalPages: number;
}

export interface GitHubInstallationsResponse {
  installations: Installation[];
  githubConnected: boolean;
  githubUsernames: string[];
}

export interface FetchAllInstallationReposRequest {
  installationId: string;
  totalPages: number;
}

export interface FetchAllInstallationReposResponse {
  repos: Repository[];
}

// Branch types
export interface Branch {
  name: string;
  isDefault?: boolean;
}

export interface GetRepositoryBranchesRequest {
  repoUrl: string;
  page: number;
}

export interface GetRepositoryBranchesResponse {
  branches: Branch[];
  page: number;
}

// Background Composer types
export enum BackgroundComposerStatus {
  UNSPECIFIED = 'BACKGROUND_COMPOSER_STATUS_UNSPECIFIED',
  RUNNING = 'BACKGROUND_COMPOSER_STATUS_RUNNING',
  FINISHED = 'BACKGROUND_COMPOSER_STATUS_FINISHED',
  ERROR = 'BACKGROUND_COMPOSER_STATUS_ERROR',
  CREATING = 'BACKGROUND_COMPOSER_STATUS_CREATING',
  EXPIRED = 'BACKGROUND_COMPOSER_STATUS_EXPIRED'
}

export enum BackgroundComposerSource {
  EDITOR = 'BACKGROUND_COMPOSER_SOURCE_EDITOR',
  WEBSITE = 'BACKGROUND_COMPOSER_SOURCE_WEBSITE'
}

export interface BackgroundComposer {
  bcId: string;
  createdAtMs: number;
  updatedAtMs: number;
  workspaceRootPath: string;
  name?: string;
  branchName?: string;
  hasStartedVm: boolean;
  repoUrl: string;
  isArchived: boolean;
  isKilled: boolean;
  status: BackgroundComposerStatus;
  source: BackgroundComposerSource;
}

export interface ListBackgroundComposersRequest {
  n: number;
  include_status: boolean;
}

export interface ListBackgroundComposersResponse {
  composers: BackgroundComposer[];
  didLoadStatus: boolean;
}

// Message types for conversation history
export enum MessageType {
  HUMAN = 'MESSAGE_TYPE_HUMAN',
  AI = 'MESSAGE_TYPE_AI'
}

export interface ConversationMessage {
  text: string;
  type: MessageType;
  richText?: string;
}

// Model configuration
export interface ModelDetails {
  modelName: SupportedModel | string;
  maxMode: boolean;
}

export interface UserInfo {
  email: string;
  email_verified: boolean;
  name: string;
  sub: string;
  updated_at: string;
  picture: string;
}

export interface GetUserInfoResponse extends UserInfo {}

// Devcontainer configuration
export interface DevcontainerStartingPoint {
  url: string;
  ref: string;
}

// Start Background Composer request
export interface StartBackgroundComposerRequest {
  snapshotNameOrId: string;
  devcontainerStartingPoint: DevcontainerStartingPoint;
  modelDetails: ModelDetails;
  repositoryInfo: Record<string, any>;
  snapshotWorkspaceRootPath: string;
  autoBranch: boolean;
  returnImmediately: boolean;
  repoUrl: string;
  conversationHistory: ConversationMessage[];
  source: BackgroundComposerSource;
  bcId: string;
  addInitialMessageToResponses: boolean;
}

export interface StartBackgroundComposerResponse {
  composer: BackgroundComposer;
}

// Archive Background Composer request
export interface ArchiveBackgroundComposerRequest {
  bcId: string;
}

// API Configuration
export interface CursorApiConfig {
  baseUrl?: string;
  cookies?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

// Error types
export interface CursorApiErrorData {
  message: string;
  status?: number;
  code?: string;
}

export class CursorApiError extends Error {
  public status?: number;
  public code?: string;

  constructor(data: CursorApiErrorData) {
    super(data.message);
    this.name = 'CursorApiError';
    this.status = data.status;
    this.code = data.code;
  }
}
