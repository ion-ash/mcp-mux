/**
 * Stub MCP Server - HTTP Transport (Streamable HTTP)
 *
 * Protocol-compliant MCP server for E2E testing using streamable HTTP transport.
 * Based on the official TypeScript SDK patterns from modelcontextprotocol/rust-sdk tests.
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3457;

// Store transports by session ID
const transports = new Map<string, StreamableHTTPServerTransport>();

// Create MCP server instance for a session
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'stub-mcp-http-server',
    version: '1.0.0',
  });

  // ============================================================================
  // TOOLS
  // ============================================================================

  server.tool(
    'echo',
    'Echo back the input message',
    { message: z.string().describe('Message to echo back') },
    async ({ message }) => ({
      content: [{ type: 'text', text: message }],
    })
  );

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

  server.tool(
    'get_time',
    'Get the current server time',
    {},
    async () => ({
      content: [{ type: 'text', text: new Date().toISOString() }],
    })
  );

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

  // ============================================================================
  // RESOURCES
  // ============================================================================

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

  server.resource(
    'greeting',
    new ResourceTemplate('greeting://{name}', { list: undefined }),
    async (uri, { name }) => ({
      contents: [
        {
          uri: uri.href,
          text: `Hello, ${name}! Welcome to the HTTP stub server.`,
          mimeType: 'text/plain',
        },
      ],
    })
  );

  return server;
}

// Handle POST requests (client-to-server messages)
app.post('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports.has(sessionId)) {
    // Reuse existing transport
    transport = transports.get(sessionId)!;
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New initialization request - create new transport and server
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        transports.set(newSessionId, transport);
        console.log(`[http-server] New session: ${newSessionId}`);
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
        console.log(`[http-server] Session closed: ${transport.sessionId}`);
      }
    };

    const server = createMcpServer();
    await server.connect(transport);
  } else {
    // Invalid request - no session and not an initialize request
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
    return;
  }

  // Handle the MCP request
  await transport.handleRequest(req, res, req.body);
});

// Handle GET requests (server-to-client notifications via SSE)
app.get('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// Handle DELETE requests (session termination)
app.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'stub-mcp-http-server',
    sessions: transports.size,
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[http-server] Stub MCP HTTP server running at http://localhost:${PORT}`);
  console.log(`[http-server] MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`[http-server] Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[http-server] Shutting down...');
  server.close(() => {
    console.log('[http-server] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[http-server] Received SIGINT, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

export { app, server };
