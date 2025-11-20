import { logger, task } from "@trigger.dev/sdk/v3";

/**
 * Webhook Handler for GitHub Push Events
 * 
 * Triggers Render deployment when code is pushed to specific branches
 */
export const githubPushWebhook = task({
  id: "github-push-webhook",
  maxDuration: 600,
  run: async (payload: {
    ref: string;
    repository: {
      full_name: string;
    };
    pusher: {
      name: string;
    };
    commits: any[];
  }) => {
    logger.log("📨 GitHub push webhook received", {
      ref: payload.ref,
      repo: payload.repository.full_name,
      pusher: payload.pusher.name,
      commitCount: payload.commits?.length || 0,
    });

    // Extract branch name from ref (refs/heads/main -> main)
    const branch = payload.ref.replace("refs/heads/", "");

    // Only deploy on specific branches
    const deployBranches = ["main", "production"];
    if (!deployBranches.includes(branch)) {
      logger.log(`⏭️ Skipping deployment - branch '${branch}' not in deploy list`);
      return {
        skipped: true,
        reason: `Branch '${branch}' is not configured for auto-deployment`,
      };
    }

    const apiServiceId = process.env.RENDER_API_SERVICE_ID;
    if (!apiServiceId) {
      throw new Error("RENDER_API_SERVICE_ID environment variable is required");
    }

    const renderApiKey = process.env.RENDER_API_KEY;
    if (!renderApiKey) {
      throw new Error("RENDER_API_KEY environment variable is required");
    }

    try {
      // Trigger Render deployment
      logger.log(`🚀 Triggering Render deployment for ${branch}...`);

      const response = await fetch(
        `https://api.render.com/v1/services/${apiServiceId}/deploys`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${renderApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clearCache: "do_not_clear",
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Render API error: ${response.status} - ${error}`);
      }

      const deployment = await response.json();
      logger.log("✅ Deployment triggered successfully", {
        deployId: deployment.id,
        status: deployment.status,
      });

      return {
        success: true,
        branch,
        deployId: deployment.id,
        commits: payload.commits?.length || 0,
        pusher: payload.pusher.name,
      };

    } catch (error: any) {
      logger.error("❌ Webhook deployment failed", { error: error.message });
      throw error;
    }
  },
});

/**
 * Manual Deployment Trigger
 * 
 * Simple task for triggering deployments manually from Trigger.dev dashboard
 */
export const manualDeploy = task({
  id: "manual-deploy",
  maxDuration: 600,
  run: async (payload: {
    branch?: string;
    clearCache?: boolean;
    serviceIds?: string[];
  } = {}) => {
    const {
      branch = "main",
      clearCache = false,
      serviceIds = [],
    } = payload;

    logger.log("👤 Manual deployment triggered", { branch, clearCache, serviceIds });

    const renderApiKey = process.env.RENDER_API_KEY;
    if (!renderApiKey) {
      throw new Error("RENDER_API_KEY environment variable is required");
    }

    const defaultServiceId = process.env.RENDER_API_SERVICE_ID;
    const servicesToDeploy = serviceIds.length > 0 ? serviceIds : [defaultServiceId];

    if (!servicesToDeploy[0]) {
      throw new Error("No service IDs provided and RENDER_API_SERVICE_ID not set");
    }

    const results = [];

    for (const serviceId of servicesToDeploy) {
      try {
        logger.log(`🚀 Deploying service ${serviceId}...`);

        const response = await fetch(
          `https://api.render.com/v1/services/${serviceId}/deploys`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${renderApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              clearCache: clearCache ? "clear" : "do_not_clear",
            }),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Render API error: ${response.status} - ${error}`);
        }

        const deployment = await response.json();
        logger.log(`✅ Service ${serviceId} deployed`, { deployId: deployment.id });

        results.push({
          serviceId,
          success: true,
          deployId: deployment.id,
          status: deployment.status,
        });

      } catch (error: any) {
        logger.error(`❌ Failed to deploy service ${serviceId}`, { error: error.message });
        results.push({
          serviceId,
          success: false,
          error: error.message,
        });
      }
    }

    const allSuccessful = results.every(r => r.success);

    return {
      success: allSuccessful,
      branch,
      deployments: results,
      message: allSuccessful
        ? "All services deployed successfully"
        : "Some deployments failed",
    };
  },
});
