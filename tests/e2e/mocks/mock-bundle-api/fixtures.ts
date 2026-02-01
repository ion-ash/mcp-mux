/**
 * Bundle Fixtures for E2E Testing
 *
 * These fixtures define test servers that point to our stub MCP servers,
 * covering all transport types, auth modes, and input configurations.
 */

// Stub server ports
const STUB_HTTP_PORT = 3457;
const STUB_OAUTH_PORT = 3458;

export interface ServerDefinition {
  id: string;
  name: string;
  alias: string;
  description: string;
  icon: string;
  schema_version: string;
  categories: string[];
  tags: string[];
  transport: {
    type: 'stdio' | 'http';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    metadata: {
      inputs: InputDefinition[];
    };
  };
  auth: {
    type: 'none' | 'api_key' | 'oauth';
    instructions?: string;
  };
  publisher: {
    name: string;
    domain?: string;
    url?: string;
    verified: boolean;
    domain_verified: boolean;
    official: boolean;
  };
  links?: {
    repository?: string;
    documentation?: string;
    homepage?: string;
  };
  platforms: string[];
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
  };
}

export interface InputDefinition {
  id: string;
  label: string;
  description?: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'url';
  required: boolean;
  secret: boolean;
  placeholder?: string;
  obtain?: {
    url: string;
    instructions: string;
    button_label: string;
  };
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface RegistryBundle {
  version: string;
  updated_at: string;
  servers: ServerDefinition[];
  categories: Category[];
  ui: {
    filters: unknown[];
    sort_options: unknown[];
    default_sort: string;
    items_per_page: number;
  };
  home?: {
    featured_server_ids: string[];
  };
}

// Test servers pointing to our stub MCP servers
const TEST_SERVERS: ServerDefinition[] = [
  // 1. Stdio server with npx (no inputs, no auth) - simplest case
  {
    id: 'echo-server',
    name: 'Echo Server',
    alias: 'echo',
    description: 'Simple echo server for testing - returns what you send',
    icon: '🔊',
    schema_version: '2.0',
    categories: ['developer-tools'],
    tags: ['test', 'echo', 'simple'],
    transport: {
      type: 'stdio',
      command: 'node',
      args: ['--experimental-strip-types', 'tests/e2e/mocks/stub-mcp-server/stdio-server.ts'],
      env: {},
      metadata: {
        inputs: [],
      },
    },
    auth: {
      type: 'none',
    },
    publisher: {
      name: 'McpMux Test',
      verified: true,
      domain_verified: false,
      official: false,
    },
    platforms: ['all'],
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    },
  },

  // 2. Stdio server with API key input
  {
    id: 'api-key-server',
    name: 'API Key Server',
    alias: 'apikey',
    description: 'Server requiring an API key input for testing input handling',
    icon: '🔑',
    schema_version: '2.0',
    categories: ['developer-tools'],
    tags: ['test', 'api-key', 'auth'],
    transport: {
      type: 'stdio',
      command: 'node',
      args: ['--experimental-strip-types', 'tests/e2e/mocks/stub-mcp-server/stdio-server.ts'],
      env: {
        TEST_API_KEY: '${input:API_KEY}',
      },
      metadata: {
        inputs: [
          {
            id: 'API_KEY',
            label: 'Test API Key',
            description: 'API key for testing (any value works)',
            type: 'password',
            required: true,
            secret: true,
            placeholder: 'test_key_xxx',
            obtain: {
              url: 'https://example.com/get-key',
              instructions: 'For testing, enter any value',
              button_label: 'Get Test Key',
            },
          },
        ],
      },
    },
    auth: {
      type: 'api_key',
      instructions: 'Enter any value for testing',
    },
    publisher: {
      name: 'McpMux Test',
      verified: true,
      domain_verified: false,
      official: false,
    },
    platforms: ['all'],
    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
    },
  },

  // 3. Stdio server with directory input (like Filesystem)
  {
    id: 'directory-server',
    name: 'Directory Server',
    alias: 'dir',
    description: 'Server with directory path input for testing path inputs',
    icon: '📂',
    schema_version: '2.0',
    categories: ['file-system'],
    tags: ['test', 'directory', 'path'],
    transport: {
      type: 'stdio',
      command: 'node',
      args: ['--experimental-strip-types', 'tests/e2e/mocks/stub-mcp-server/stdio-server.ts', '${input:DIRECTORY}'],
      env: {},
      metadata: {
        inputs: [
          {
            id: 'DIRECTORY',
            label: 'Target Directory',
            description: 'Directory path to operate on',
            type: 'text',
            required: true,
            secret: false,
            placeholder: 'C:\\Users\\test',
          },
        ],
      },
    },
    auth: {
      type: 'none',
    },
    publisher: {
      name: 'McpMux Test',
      verified: true,
      domain_verified: false,
      official: false,
    },
    platforms: ['all'],
    capabilities: {
      tools: true,
      resources: true,
      prompts: false,
    },
  },

  // 4. HTTP server with no auth (like Cloudflare Docs)
  {
    id: 'http-noauth-server',
    name: 'HTTP Server (No Auth)',
    alias: 'httptest',
    description: 'HTTP server without authentication for testing remote connections',
    icon: '🌐',
    schema_version: '2.0',
    categories: ['cloud'],
    tags: ['test', 'http', 'remote'],
    transport: {
      type: 'http',
      url: `http://localhost:${STUB_HTTP_PORT}/mcp`,
      metadata: {
        inputs: [],
      },
    },
    auth: {
      type: 'none',
    },
    publisher: {
      name: 'McpMux Test',
      verified: true,
      domain_verified: false,
      official: false,
    },
    platforms: ['all'],
    capabilities: {
      tools: true,
      resources: true,
      prompts: false,
    },
  },

  // 5. HTTP server with OAuth (like Atlassian)
  {
    id: 'http-oauth-server',
    name: 'HTTP Server (OAuth)',
    alias: 'oauthtest',
    description: 'HTTP server with OAuth authentication for testing auth flows',
    icon: '🔐',
    schema_version: '2.0',
    categories: ['productivity'],
    tags: ['test', 'http', 'oauth'],
    transport: {
      type: 'http',
      url: `http://localhost:${STUB_OAUTH_PORT}/mcp`,
      metadata: {
        inputs: [],
      },
    },
    auth: {
      type: 'oauth',
    },
    publisher: {
      name: 'McpMux Test',
      verified: true,
      domain_verified: false,
      official: false,
    },
    platforms: ['all'],
    capabilities: {
      tools: true,
      resources: false,
      prompts: true,
    },
  },

  // 6. HTTP server with API key (header-based)
  {
    id: 'http-apikey-server',
    name: 'HTTP Server (API Key)',
    alias: 'httpkey',
    description: 'HTTP server requiring API key in header',
    icon: '🔒',
    schema_version: '2.0',
    categories: ['search'],
    tags: ['test', 'http', 'api-key'],
    transport: {
      type: 'http',
      url: `http://localhost:${STUB_HTTP_PORT}/mcp`,
      metadata: {
        inputs: [],
      },
    },
    auth: {
      type: 'api_key',
      instructions: 'Enter any value for testing',
    },
    publisher: {
      name: 'McpMux Test',
      verified: true,
      domain_verified: false,
      official: false,
    },
    platforms: ['all'],
    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
    },
  },
];

const TEST_CATEGORIES: Category[] = [
  { id: 'developer-tools', name: 'Developer Tools', icon: '💻' },
  { id: 'file-system', name: 'File System', icon: '📂' },
  { id: 'cloud', name: 'Cloud', icon: '☁️' },
  { id: 'productivity', name: 'Productivity', icon: '⚡' },
  { id: 'search', name: 'Search', icon: '🔍' },
];

export const BUNDLE_DATA: RegistryBundle = {
  version: '2.0.0-test',
  updated_at: new Date().toISOString().split('T')[0],
  servers: TEST_SERVERS,
  categories: TEST_CATEGORIES,
  ui: {
    filters: [
      {
        id: 'category',
        label: 'Category',
        type: 'single',
        options: [
          { id: 'all', label: 'All Categories' },
          { id: 'developer-tools', label: 'Developer Tools', icon: '💻', match: { field: 'categories', operator: 'contains', value: 'developer-tools' } },
          { id: 'file-system', label: 'File System', icon: '📂', match: { field: 'categories', operator: 'contains', value: 'file-system' } },
          { id: 'cloud', label: 'Cloud', icon: '☁️', match: { field: 'categories', operator: 'contains', value: 'cloud' } },
        ],
      },
      {
        id: 'auth',
        label: 'Auth Required',
        type: 'single',
        options: [
          { id: 'all', label: 'All' },
          { id: 'none', label: 'No Auth', match: { field: 'auth.type', operator: 'eq', value: 'none' } },
          { id: 'api_key', label: 'API Key', match: { field: 'auth.type', operator: 'eq', value: 'api_key' } },
          { id: 'oauth', label: 'OAuth', match: { field: 'auth.type', operator: 'eq', value: 'oauth' } },
        ],
      },
      {
        id: 'transport',
        label: 'Transport',
        type: 'single',
        options: [
          { id: 'all', label: 'All' },
          { id: 'http', label: 'Remote (HTTP)', match: { field: 'transport.type', operator: 'eq', value: 'http' } },
          { id: 'stdio', label: 'Local (Stdio)', match: { field: 'transport.type', operator: 'eq', value: 'stdio' } },
        ],
      },
    ],
    sort_options: [
      {
        id: 'name_asc',
        label: 'Name A-Z',
        rules: [{ field: 'name', direction: 'asc' }],
      },
    ],
    default_sort: 'name_asc',
    items_per_page: 24,
  },
  home: {
    featured_server_ids: ['echo-server', 'http-noauth-server'],
  },
};
