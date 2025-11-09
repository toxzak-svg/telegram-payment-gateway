// Core server utilities and shared functionality
export class ServerBase {
  protected port: number;
  protected environment: string;

  constructor(port: number = 3000, environment: string = 'development') {
    this.port = port;
    this.environment = environment;
  }

  protected validateEnvironment(): void {
    const requiredEnvVars = [
      'DATABASE_URL',
      'TELEGRAM_BOT_TOKEN',
      'API_SECRET_KEY'
    ];

    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(\`Missing required environment variables: \${missing.join(', ')}\`);
    }
  }

  protected logServerStart(): void {
    console.log(\`🚀 Server started in \${this.environment} mode\`);
    console.log(\`📡 Listening on port \${this.port}\`);
    console.log(\`🔗 API URL: http://localhost:\${this.port}\`);
  }

  protected setupGracefulShutdown(cleanup: () => Promise<void>): void {
    const shutdown = async (signal: string) => {
      console.log(\`\\n\${signal} received. Starting graceful shutdown...\`);
      await cleanup();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

export default ServerBase;
