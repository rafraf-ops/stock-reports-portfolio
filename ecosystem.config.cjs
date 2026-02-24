module.exports = {
  apps: [{
    name: 'financial-analyzer',
    script: 'src/server.js',
    cwd: './backend',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
