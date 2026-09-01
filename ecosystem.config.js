'use strict';

module.exports = {
  apps: [
    {
      name: process.env.PM2_PROCESS_NAME || 'pupi-backend',
      script: 'dist/main.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
    },
  ],
};
