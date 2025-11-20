import { logger, schedules } from "@trigger.dev/sdk/v3";
import { fullDeploymentPipeline } from "./render-deploy";

/**
 * Scheduled Deployment Task
 * 
 * Automatically deploys to Render on a schedule (e.g., nightly builds)
 * Configure the schedule in Trigger.dev dashboard or here
 */
export const scheduledDeployment = schedules.task({
  id: "scheduled-deployment",
  // Run every day at 2 AM UTC (optional - can be configured in dashboard)
  // cron: "0 2 * * *",
  run: async (payload) => {
    logger.log("⏰ Starting scheduled deployment");

    const apiServiceId = process.env.RENDER_API_SERVICE_ID;
    const workerServiceIds = process.env.RENDER_WORKER_SERVICE_IDS?.split(",") || [];
    const healthCheckUrl = process.env.API_HEALTH_CHECK_URL;

    if (!apiServiceId) {
      logger.error("❌ RENDER_API_SERVICE_ID not configured");
      throw new Error("RENDER_API_SERVICE_ID environment variable is required");
    }

    try {
      const result = await fullDeploymentPipeline.triggerAndWait({
        apiServiceId,
        workerServiceIds,
        branch: "main",
        clearCache: false,
        runMigrations: true,
        healthCheckUrl,
      });

      logger.log("✅ Scheduled deployment completed", result);

      return result;
    } catch (error: any) {
      logger.error("❌ Scheduled deployment failed", { error: error.message });
      throw error;
    }
  },
});
