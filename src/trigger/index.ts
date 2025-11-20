/**
 * Trigger.dev Tasks Index
 * 
 * All Trigger.dev tasks for the Telegram Payment Gateway
 */

// Example task
export { helloWorldTask } from "./example";

// Render deployment tasks
export {
  deployToRender,
  runMigrations,
  fullDeploymentPipeline,
} from "./render-deploy";

// Scheduled deployments
export { scheduledDeployment } from "./scheduled-deploy";

// Webhook handlers
export {
  githubPushWebhook,
  manualDeploy,
} from "./webhooks";
