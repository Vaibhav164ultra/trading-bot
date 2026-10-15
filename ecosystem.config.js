/**
 * PM2 ecosystem configuration for cloud deployment
 */

module.exports = {
  apps: [{
    name: 'zerodha-bot',
    script: 'dist/live.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
    },
    // Restart on crash with exponential backoff
    restart_delay: 4000,
    max_restarts: 10,
    // Log rotation
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    merge_logs: true,
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 8000,
  }]
};
