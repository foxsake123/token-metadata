/**
 * Telegram Bot Server with Health Check
 *
 * Wraps the admin bot with an HTTP server for Railway deployment.
 * Railway needs a health check endpoint to know the service is running.
 */

import * as http from 'http';

// Start the admin bot
import './admin-bot';

// Create health check server
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'LIST Telegram Bot',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});
