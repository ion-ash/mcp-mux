/**
 * Mock Bundle API Server for E2E Testing
 *
 * This server mocks the mcpmux.serverhub.api bundle endpoint,
 * returning configurable server definitions for testing different scenarios.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createHash } from 'crypto';
import { BUNDLE_DATA } from './fixtures.js';

const app = express();
const PORT = process.env.PORT || 3456;

app.use(cors());
app.use(express.json());

// Calculate ETag for bundle data
function calculateETag(data: unknown): string {
  const json = JSON.stringify(data);
  return createHash('sha256').update(json).digest('hex').substring(0, 16);
}

// GET /v1/bundle - Main bundle endpoint
app.get('/v1/bundle', (req: Request, res: Response) => {
  const ifNoneMatch = req.headers['if-none-match'];
  const etag = calculateETag(BUNDLE_DATA);

  // Support conditional requests
  if (ifNoneMatch === etag) {
    res.status(304).end();
    return;
  }

  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  res.json({
    data: BUNDLE_DATA,
    meta: {
      total_servers: BUNDLE_DATA.servers.length,
      total_categories: BUNDLE_DATA.categories.length,
      version: BUNDLE_DATA.version,
      updated_at: BUNDLE_DATA.updated_at,
    },
  });
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'mock-bundle-api' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[mock-bundle-api] Server running at http://localhost:${PORT}`);
  console.log(`[mock-bundle-api] Bundle endpoint: http://localhost:${PORT}/v1/bundle`);
  console.log(`[mock-bundle-api] Serving ${BUNDLE_DATA.servers.length} test servers`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[mock-bundle-api] Shutting down...');
  server.close(() => {
    console.log('[mock-bundle-api] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[mock-bundle-api] Received SIGINT, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

export { app, server };
