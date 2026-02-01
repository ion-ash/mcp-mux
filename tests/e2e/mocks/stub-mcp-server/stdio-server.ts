/**
 * Stub MCP Server - Stdio Transport
 *
 * Protocol-compliant MCP server for E2E testing using stdio transport.
 * Based on the official TypeScript SDK patterns from modelcontextprotocol/rust-sdk tests.
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Create MCP server
const server = new McpServer({
  name: 'stub-mcp-server',
  version: '1.0.0',
});

// ============================================================================
// TOOLS
// ============================================================================

// Echo tool - returns what you send
server.tool(
  'echo',
  'Echo back the input message',
  { message: z.string().describe('Message to echo back') },
  async ({ message }) => ({
    content: [{ type: 'text', text: message }],
  })
);

// Add tool - adds two numbers
server.tool(
  'add',
  'Add two numbers together',
  {
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: String(a + b) }],
  })
);

// Get time tool - returns current server time
server.tool(
  'get_time',
  'Get the current server time',
  {},
  async () => ({
    content: [{ type: 'text', text: new Date().toISOString() }],
  })
);

// Get env tool - returns environment variables (for testing input injection)
server.tool(
  'get_env',
  'Get environment variable value',
  { name: z.string().describe('Environment variable name') },
  async ({ name }) => ({
    content: [{ type: 'text', text: process.env[name] ?? '(not set)' }],
  })
);

// Slow task tool - simulates a long-running operation
server.tool(
  'slow_task',
  'Simulate a slow operation',
  { duration_ms: z.number().default(1000).describe('Duration in milliseconds') },
  async ({ duration_ms }) => {
    await new Promise((resolve) => setTimeout(resolve, duration_ms));
    return {
      content: [{ type: 'text', text: `Completed after ${duration_ms}ms` }],
    };
  }
);

// Error tool - for testing error handling
server.tool(
  'error',
  'Intentionally throw an error',
  { message: z.string().default('Test error') },
  async ({ message }) => {
    throw new Error(message);
  }
);

// ============================================================================
// RESOURCES
// ============================================================================

// Static config resource
server.resource(
  'config',
  new ResourceTemplate('config://settings', { list: undefined }),
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify({ theme: 'dark', language: 'en', version: '1.0.0' }),
        mimeType: 'application/json',
      },
    ],
  })
);

// Greeting resource with template
server.resource(
  'greeting',
  new ResourceTemplate('greeting://{name}', { list: undefined }),
  async (uri, { name }) => ({
    contents: [
      {
        uri: uri.href,
        text: `Hello, ${name}! Welcome to the stub MCP server.`,
        mimeType: 'text/plain',
      },
    ],
  })
);

// Status resource
server.resource(
  'status',
  new ResourceTemplate('status://server', { list: undefined }),
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify({
          status: 'running',
          uptime: process.uptime(),
          pid: process.pid,
          memory: process.memoryUsage(),
        }),
        mimeType: 'application/json',
      },
    ],
  })
);

// ============================================================================
// PROMPTS
// ============================================================================

server.prompt(
  'greeting',
  'Generate a greeting message',
  { name: z.string().describe('Name to greet') },
  async ({ name }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please greet ${name} warmly and ask how their day is going.`,
        },
      },
    ],
  })
);

server.prompt(
  'code_review',
  'Review code and suggest improvements',
  {
    language: z.string().describe('Programming language'),
    code: z.string().describe('Code to review'),
  },
  async ({ language, code }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please review the following ${language} code and suggest improvements:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      },
    ],
  })
);

// ============================================================================
// START SERVER
// ============================================================================

const transport = new StdioServerTransport();

console.error('[stub-mcp-server] Starting stdio server...');
console.error('[stub-mcp-server] Tools: echo, add, get_time, get_env, slow_task, error');
console.error('[stub-mcp-server] Resources: config://settings, greeting://{name}, status://server');
console.error('[stub-mcp-server] Prompts: greeting, code_review');

await server.connect(transport);
console.error('[stub-mcp-server] Connected and ready');
