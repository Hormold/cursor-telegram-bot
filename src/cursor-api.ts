import {
  CursorApiConfig,
  CursorApiError,
  CursorApiResponse,
  GitHubInstallationsResponse,
  FetchAllInstallationReposRequest,
  FetchAllInstallationReposResponse,
  GetRepositoryBranchesRequest,
  GetRepositoryBranchesResponse,
  ListBackgroundComposersRequest,
  ListBackgroundComposersResponse,
  StartBackgroundComposerRequest,
  StartBackgroundComposerResponse,
  ArchiveBackgroundComposerRequest,
  BackgroundComposer,
  ConversationMessage,
  ConversationImage,
  MessageType,
  BackgroundComposerSource,
  DevcontainerStartingPoint,
  ModelDetails,
  GetUserInfoResponse,
  SupportedModel,
} from './types/cursor-api';

export class CursorApi {
  private config: CursorApiConfig;
  private baseUrl: string;

  constructor(config: CursorApiConfig) {
    this.config = {
      baseUrl: 'https://cursor.com',
      timeout: 30000,
      ...config,
    };
    this.baseUrl = this.config.baseUrl!;
  }

  /**
   * General method for making HTTP requests
   * @private
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9,ru;q=0.8',
      'content-type': 'application/json',
      'dnt': '1',
      'origin': this.baseUrl,
      'referer': `${this.baseUrl}/agents`,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      ...(this.config.cookies && this.config.cookies.trim() ? { 'cookie': this.config.cookies } : {}),
      ...this.config.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        throw new CursorApiError({
          message: error.message,
          status: error.name === 'AbortError' ? 408 : undefined,
        });
      }
      
      throw new CursorApiError({
        message: 'Unknown error occurred',
      });
    }
  }

  /**
   * Get current user information
   * Checks authentication and returns user information
   * 
   * @returns {Promise<GetUserInfoResponse>} User information
   */
  async getUserInfo(): Promise<GetUserInfoResponse> {
    return this.request<GetUserInfoResponse>(
      '/api/auth/me',
      {
        method: 'GET',
      }
    );
  }

  /**
   * Get all GitHub installations with repositories
   * Returns list of all connected GitHub installations with their repositories
   * 
   * @returns {Promise<GitHubInstallationsResponse>} List of GitHub installations
   */
  async getGitHubInstallations(): Promise<GitHubInstallationsResponse> {
    return this.request<GitHubInstallationsResponse>(
      '/api/dashboard/get-github-installations',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
  }

  /**
   * Get all repositories for a specific installation
   * Used to get the complete list of repositories in an installation with pagination
   * 
   * @param {FetchAllInstallationReposRequest} request - Request parameters
   * @returns {Promise<FetchAllInstallationReposResponse>} List of repositories
   */
  async fetchAllInstallationRepos(
    request: FetchAllInstallationReposRequest
  ): Promise<FetchAllInstallationReposResponse> {
    return this.request<FetchAllInstallationReposResponse>(
      '/api/dashboard/fetch-all-installation-repos',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Get repository branches list
   * Returns available branches for the specified repository
   * 
   * @param {GetRepositoryBranchesRequest} request - Request parameters
   * @returns {Promise<GetRepositoryBranchesResponse>} List of branches
   */
  async getRepositoryBranches(
    request: GetRepositoryBranchesRequest
  ): Promise<GetRepositoryBranchesResponse> {
    return this.request<GetRepositoryBranchesResponse>(
      '/api/background-composer/get-repository-branches',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Get list of all background composers
   * Returns list of all created background composers with their statuses
   * 
   * @param {ListBackgroundComposersRequest} request - Request parameters
   * @returns {Promise<ListBackgroundComposersResponse>} List of composers
   */
  async listBackgroundComposers(
    request: ListBackgroundComposersRequest = { n: 100, include_status: true }
  ): Promise<ListBackgroundComposersResponse> {
    return this.request<ListBackgroundComposersResponse>(
      '/api/background-composer/list',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Create and start a new background composer
   * Starts a new AI worker for working with the repository
   * 
   * @param {StartBackgroundComposerRequest} request - Request parameters
   * @returns {Promise<StartBackgroundComposerResponse>} Information about the created composer
   */
  async startBackgroundComposer(
    request: StartBackgroundComposerRequest
  ): Promise<StartBackgroundComposerResponse> {
    return this.request<StartBackgroundComposerResponse>(
      '/api/auth/startBackgroundComposerFromSnapshot',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Archive (cancel) background composer
   * Stops and archives the specified background composer
   * 
   * @param {ArchiveBackgroundComposerRequest} request - Request parameters
   * @returns {Promise<void>}
   */
  async archiveBackgroundComposer(
    request: ArchiveBackgroundComposerRequest
  ): Promise<void> {
    await this.request(
      '/api/auth/archiveBackgroundComposer',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  // Utility methods

  /**
   * Create a simple message for conversation history
   * Helper for creating messages in the correct format
   * 
   * @param {string} text - Message text
   * @param {MessageType} type - Message type (HUMAN or AI)
   * @param {ConversationImage[]} images - Optional images array
   * @returns {ConversationMessage} Formatted message
   */
  createMessage(
    text: string, 
    type: MessageType = MessageType.HUMAN,
    images?: ConversationImage[]
  ): ConversationMessage {
    const message: ConversationMessage = {
      text,
      type,
      richText: JSON.stringify({
        root: {
          children: [
            {
              children: [
                {
                  detail: 0,
                  format: 0,
                  mode: 'normal',
                  style: '',
                  text,
                  type: 'text',
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              type: 'paragraph',
              version: 1,
              textFormat: 0,
              textStyle: '',
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      }),
    };

    if (images && images.length > 0) {
      message.images = images;
    }

    return message;
  }

  /**
   * Generate unique ID for background composer
   * Creates a unique identifier in the format bc-uuid
   * 
   * @returns {string} Unique ID
   */
  generateBcId(): string {
    return `bc-${crypto.randomUUID()}`;
  }

  /**
   * Create basic configuration for launching composer
   * Helper for creating standard launch parameters
   * 
   * @param {string} repoUrl - Repository URL
   * @param {string} task - Task for AI
   * @param {string} branch - Branch (default 'main')
   * @param {SupportedModel | string} modelName - AI model (default 'claude-4-sonnet-thinking')
   * @param {ConversationImage[]} images - Optional images array
   * @returns {Partial<StartBackgroundComposerRequest>} Basic configuration
   */
  createBaseComposerConfig(
    repoUrl: string,
    task: string,
    branch: string = 'main',
    modelName: SupportedModel | string = SupportedModel.CLAUDE_4_SONNET_THINKING,
    images?: ConversationImage[]
  ): Partial<StartBackgroundComposerRequest> {
    const bcId = this.generateBcId();
    
    return {
      snapshotNameOrId: repoUrl,
      devcontainerStartingPoint: {
        url: repoUrl,
        ref: branch,
      },
      modelDetails: {
        modelName,
        maxMode: true,
      },
      repositoryInfo: {},
      snapshotWorkspaceRootPath: '/workspace',
      autoBranch: true,
      returnImmediately: true,
      repoUrl,
      conversationHistory: [this.createMessage(task, MessageType.HUMAN, images)],
      source: BackgroundComposerSource.WEBSITE,
      bcId,
      addInitialMessageToResponses: true,
    };
  }

  /**
   * Start composer with a simple task
   * Simplified method for quickly launching an AI worker
   * 
   * @param {string} repoUrl - Repository URL
   * @param {string} task - Task for AI
   * @param {string} branch - Branch (default 'main')
   * @param {SupportedModel | string} modelName - AI model (default 'claude-4-sonnet-thinking')
   * @param {ConversationImage[]} images - Optional images array
   * @returns {Promise<StartBackgroundComposerResponse>} Information about the created composer
   */
  async startSimpleComposer(
    repoUrl: string,
    task: string,
    branch: string = 'main',
    modelName: SupportedModel | string = SupportedModel.CLAUDE_4_SONNET_THINKING,
    images?: ConversationImage[]
  ): Promise<StartBackgroundComposerResponse> {
    const config = this.createBaseComposerConfig(repoUrl, task, branch, modelName, images);
    
    return this.startBackgroundComposer(config as StartBackgroundComposerRequest);
  }

  /**
   * Get active composers
   * Returns only active (not archived) composers
   * 
   * @returns {Promise<BackgroundComposer[]>} List of active composers
   */
  async getActiveComposers(): Promise<BackgroundComposer[]> {
    const response = await this.listBackgroundComposers();
    return response.composers.filter(composer => !composer.isArchived);
  }

  /**
   * Find composer by ID
   * Search for a specific composer by its ID
   * 
   * @param {string} bcId - Composer ID
   * @returns {Promise<BackgroundComposer | null>} Found composer or null
   */
  async findComposerById(bcId: string): Promise<BackgroundComposer | null> {
    const response = await this.listBackgroundComposers();
    return response.composers.find(composer => composer.bcId === bcId) || null;
  }
}

export default CursorApi; 