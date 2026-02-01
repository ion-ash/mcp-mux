/**
 * Stub MCP Server - HTTP Transport with OAuth 2.0 Simulation
 *
 * Protocol-compliant MCP server with OAuth authentication for E2E testing.
 * Implements OAuth 2.0 authorization code flow with PKCE.
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import express, { Request, Response, NextFunction } from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3458;

// OAuth state storage (in-memory for testing)
interface RegisteredClient {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
  client_name?: string;
}

interface AuthorizationCode {
  code: string;
  client_id: string;
  redirect_uri: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
  expires_at: number;
}

interface AccessToken {
  access_token: string;
  refresh_token: string;
  client_id: string;
  scope?: string;
  expires_at: number;
}

const registeredClients = new Map<string, RegisteredClient>();
const authorizationCodes = new Map<string, AuthorizationCode>();
const accessTokens = new Map<string, AccessToken>();
const transports = new Map<string, StreamableHTTPServerTransport>();

// ============================================================================
// OAuth 2.0 Endpoints
// ============================================================================

// OAuth Authorization Server Metadata (RFC 8414)
app.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
  const baseUrl = `http://localhost:${PORT}`;
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    registration_endpoint: `${baseUrl}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    scopes_supported: ['mcp:read', 'mcp:write'],
  });
});

// Dynamic Client Registration (RFC 7591)
app.post('/register', (req: Request, res: Response) => {
  const { redirect_uris, client_name } = req.body;

  if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
    res.status(400).json({
      error: 'invalid_redirect_uri',
      error_description: 'redirect_uris is required and must be a non-empty array',
    });
    return;
  }

  const client_id = `test_client_${randomUUID().substring(0, 8)}`;
  const client_secret = `test_secret_${randomUUID()}`;

  const client: RegisteredClient = {
    client_id,
    client_secret,
    redirect_uris,
    client_name,
  };

  registeredClients.set(client_id, client);

  console.log(`[oauth-server] Registered client: ${client_id}`);

  res.status(201).json({
    client_id,
    client_secret,
    redirect_uris,
    client_name,
    token_endpoint_auth_method: 'client_secret_post',
  });
});

// Authorization Endpoint
app.get('/authorize', (req: Request, res: Response) => {
  const {
    client_id,
    redirect_uri,
    response_type,
    code_challenge,
    code_challenge_method,
    state,
    scope,
  } = req.query as Record<string, string>;

  // Validate client
  const client = registeredClients.get(client_id);
  if (!client) {
    res.status(400).json({ error: 'invalid_client', error_description: 'Unknown client' });
    return;
  }

  // Validate redirect_uri
  if (!client.redirect_uris.includes(redirect_uri)) {
    res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'Redirect URI not registered' });
    return;
  }

  // Validate response_type
  if (response_type !== 'code') {
    res.status(400).json({ error: 'unsupported_response_type', error_description: 'Only code response type is supported' });
    return;
  }

  // For testing: auto-approve and redirect with code
  const code = randomUUID();
  const authCode: AuthorizationCode = {
    code,
    client_id,
    redirect_uri,
    code_challenge,
    code_challenge_method,
    scope,
    expires_at: Date.now() + 10 * 60 * 1000, // 10 minutes
  };

  authorizationCodes.set(code, authCode);
  console.log(`[oauth-server] Issued authorization code: ${code}`);

  // Redirect back with code
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  res.redirect(redirectUrl.toString());
});

// Token Endpoint
app.post('/token', (req: Request, res: Response) => {
  const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier, refresh_token } = req.body;

  // Validate client credentials
  const client = registeredClients.get(client_id);
  if (!client || client.client_secret !== client_secret) {
    res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client credentials' });
    return;
  }

  if (grant_type === 'authorization_code') {
    // Exchange code for token
    const authCode = authorizationCodes.get(code);
    if (!authCode) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid authorization code' });
      return;
    }

    // Validate code
    if (authCode.client_id !== client_id || authCode.redirect_uri !== redirect_uri) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'Code does not match request' });
      return;
    }

    // Validate PKCE if used
    if (authCode.code_challenge && authCode.code_challenge_method) {
      if (!code_verifier) {
        res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier required' });
        return;
      }

      let computedChallenge: string;
      if (authCode.code_challenge_method === 'S256') {
        computedChallenge = createHash('sha256')
          .update(code_verifier)
          .digest('base64url');
      } else {
        computedChallenge = code_verifier;
      }

      if (computedChallenge !== authCode.code_challenge) {
        res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
        return;
      }
    }

    // Check expiration
    if (Date.now() > authCode.expires_at) {
      authorizationCodes.delete(code);
      res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired' });
      return;
    }

    // Delete used code
    authorizationCodes.delete(code);

    // Issue tokens
    const access_token = `test_access_${randomUUID()}`;
    const new_refresh_token = `test_refresh_${randomUUID()}`;

    const tokenData: AccessToken = {
      access_token,
      refresh_token: new_refresh_token,
      client_id,
      scope: authCode.scope,
      expires_at: Date.now() + 3600 * 1000, // 1 hour
    };

    accessTokens.set(access_token, tokenData);
    console.log(`[oauth-server] Issued access token: ${access_token.substring(0, 20)}...`);

    res.json({
      access_token,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: new_refresh_token,
      scope: authCode.scope,
    });
  } else if (grant_type === 'refresh_token') {
    // Refresh token flow
    const existingToken = [...accessTokens.values()].find((t) => t.refresh_token === refresh_token && t.client_id === client_id);

    if (!existingToken) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid refresh token' });
      return;
    }

    // Issue new tokens
    const new_access_token = `test_access_${randomUUID()}`;
    const new_refresh_token = `test_refresh_${randomUUID()}`;

    const tokenData: AccessToken = {
      access_token: new_access_token,
      refresh_token: new_refresh_token,
      client_id,
      scope: existingToken.scope,
      expires_at: Date.now() + 3600 * 1000,
    };

    // Remove old token, add new
    accessTokens.delete(existingToken.access_token);
    accessTokens.set(new_access_token, tokenData);

    console.log(`[oauth-server] Refreshed token: ${new_access_token.substring(0, 20)}...`);

    res.json({
      access_token: new_access_token,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: new_refresh_token,
      scope: existingToken.scope,
    });
  } else {
    res.status(400).json({ error: 'unsupported_grant_type', error_description: 'Only authorization_code and refresh_token are supported' });
  }
});

// ============================================================================
// Bearer Token Validation Middleware
// ============================================================================

function validateBearerToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: Bearer token required',
      },
      id: null,
    });
    return;
  }

  const token = authHeader.substring(7);
  const tokenData = accessTokens.get(token);

  if (!tokenData) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: Invalid or expired token',
      },
      id: null,
    });
    return;
  }

  if (Date.now() > tokenData.expires_at) {
    accessTokens.delete(token);
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: Token expired',
      },
      id: null,
    });
    return;
  }

  next();
}

// ============================================================================
// MCP Server
// ============================================================================

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'stub-mcp-oauth-server',
    version: '1.0.0',
  });

  server.tool(
    'echo',
    'Echo back the input message (requires auth)',
    { message: z.string().describe('Message to echo back') },
    async ({ message }) => ({
      content: [{ type: 'text', text: `[authenticated] ${message}` }],
    })
  );

  server.tool(
    'whoami',
    'Get information about the authenticated client',
    {},
    async () => ({
      content: [{ type: 'text', text: 'Authenticated test user' }],
    })
  );

  return server;
}

// MCP endpoints (protected by bearer token)
app.post('/mcp', validateBearerToken, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports.has(sessionId)) {
    transport = transports.get(sessionId)!;
  } else if (!sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        transports.set(newSessionId, transport);
        console.log(`[oauth-server] New MCP session: ${newSessionId}`);
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
        console.log(`[oauth-server] MCP session closed: ${transport.sessionId}`);
      }
    };

    const server = createMcpServer();
    await server.connect(transport);
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', validateBearerToken, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

app.delete('/mcp', validateBearerToken, async (req: Request, res: Response) => {
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
    service: 'stub-mcp-oauth-server',
    clients: registeredClients.size,
    sessions: transports.size,
    tokens: accessTokens.size,
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[oauth-server] Stub MCP OAuth server running at http://localhost:${PORT}`);
  console.log(`[oauth-server] OAuth metadata: http://localhost:${PORT}/.well-known/oauth-authorization-server`);
  console.log(`[oauth-server] MCP endpoint: http://localhost:${PORT}/mcp (requires Bearer token)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[oauth-server] Shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[oauth-server] Received SIGINT, shutting down...');
  server.close(() => process.exit(0));
});

export { app, server };
