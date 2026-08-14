module.exports = {
  apps: [
    {
      name: 'cms-gateway',
      cwd: './gateway',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      }
    },
    {
      name: 'cms-core',
      cwd: './services/core',
      script: 'src/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5002
      }
    },
    {
      name: 'cms-attendance',
      cwd: './services/attendance',
      script: 'src/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5003
      }
    },
    {
      name: 'cms-ai',
      cwd: './services/ai',
      script: 'src/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5004
      }
    }
  ]
};
