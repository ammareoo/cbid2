// CommonJS entry point for a cPanel Node selector that loads the startup file with require().
'use strict';
const path = require('node:path');
process.chdir(__dirname);
require('dotenv').config({ quiet: true });
process.env.SERVE_STATIC_DIR = path.resolve(__dirname, '../web');
if (process.env.NODE_ENV !== 'production') throw new Error('Set the application mode to production');
if (process.env.DATABASE_OWNER_URL) throw new Error('Remove maintenance credentials from the web process');
import('./dist/index.js').catch((error) => {
  console.error('LMS startup failed:', error.message);
  process.exit(1);
});
