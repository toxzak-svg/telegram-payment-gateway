import { logger, task } from "@trigger.dev/sdk/v3";
import { execSync } from "child_process";

/**
 * Render Deployment Task
 * 
 * Deploys the Telegram Payment Gateway to Render.com
 * Triggers deployment via Render API or git push
 */
export const deployToRender = task({
  id: "deploy-to-render",
  maxDuration: 600, // 10 minutes max
  retry: {
    maxAttempts: 2,
  },
  run: async (payload: { 
    serviceId?: string;
    branch?: string;
    clearCache?: boolean;
  }) => {
    const { serviceId, branch = "main", clearCache = false } = payload;

    logger.log("🚀 Starting Render deployment", { serviceId, branch, clearCache });

    try {
      // Step 1: Verify git status
      logger.log("📋 Checking git status...");
      const gitStatus = execSync("git status --porcelain", { encoding: "utf-8" });
      
      if (gitStatus.trim()) {
        logger.warn("⚠️ Uncommitted changes detected", { changes: gitStatus });
        throw new Error("Please commit all changes before deploying");
      }

      // Step 2: Run build locally to verify
      logger.log("🔨 Running local build verification...");
      execSync("npm run build", { 
        encoding: "utf-8",
        stdio: "pipe" 
      });
      logger.log("✅ Local build successful");

      // Step 3: Push to GitHub (triggers Render auto-deploy if enabled)
      logger.log(`📤 Pushing to GitHub (${branch})...`);
      execSync(`git push origin ${branch}`, {
        encoding: "utf-8",
        stdio: "pipe"
      });
      logger.log("✅ Code pushed to GitHub");

      // Step 4: Trigger Render deploy via API if serviceId provided
      if (serviceId) {
        logger.log("🎯 Triggering Render deployment via API...");
        
        const renderApiKey = process.env.RENDER_API_KEY;
        if (!renderApiKey) {
          logger.warn("⚠️ RENDER_API_KEY not set. Skipping API trigger.");
          logger.info("💡 Deploy will happen automatically via GitHub hook if configured");
        } else {
          // Trigger Render deployment
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
          logger.log("✅ Render deployment triggered", { 
            deployId: deployment.id,
            status: deployment.status 
          });

          return {
            success: true,
            deployId: deployment.id,
            status: deployment.status,
            dashboardUrl: `https://dashboard.render.com/web/${serviceId}`,
          };
        }
      }

      return {
        success: true,
        message: "Code pushed to GitHub. Render will auto-deploy if configured.",
        branch,
      };

    } catch (error: any) {
      logger.error("❌ Deployment failed", { 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  },
});

/**
 * Database Migration Task
 * 
 * Runs database migrations on Render after deployment
 */
export const runMigrations = task({
  id: "run-migrations",
  maxDuration: 300, // 5 minutes
  run: async (payload: { serviceId: string }) => {
    const { serviceId } = payload;

    logger.log("🗄️ Running database migrations", { serviceId });

    const renderApiKey = process.env.RENDER_API_KEY;
    if (!renderApiKey) {
      throw new Error("RENDER_API_KEY environment variable is required");
    }

    try {
      // Trigger one-off job to run migrations
      const response = await fetch(
        `https://api.render.com/v1/services/${serviceId}/jobs`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${renderApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startCommand: "npm run migrate",
            planId: "starter", // or your plan
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Render API error: ${response.status} - ${error}`);
      }

      const job = await response.json();
      logger.log("✅ Migration job started", { jobId: job.id });

      return {
        success: true,
        jobId: job.id,
        message: "Database migrations triggered successfully",
      };

    } catch (error: any) {
      logger.error("❌ Migration failed", { error: error.message });
      throw error;
    }
  },
});

/**
 * Full Deployment Pipeline
 * 
 * Orchestrates the complete deployment process:
 * 1. Deploy code to Render
 * 2. Wait for deployment to complete
 * 3. Run database migrations
 * 4. Verify health check
 */
export const fullDeploymentPipeline = task({
  id: "full-deployment-pipeline",
  maxDuration: 900, // 15 minutes
  run: async (payload: {
    apiServiceId: string;
    workerServiceIds?: string[];
    branch?: string;
    clearCache?: boolean;
    runMigrations?: boolean;
    healthCheckUrl?: string;
  }) => {
    const {
      apiServiceId,
      workerServiceIds = [],
      branch = "main",
      clearCache = false,
      runMigrations: shouldRunMigrations = true,
      healthCheckUrl,
    } = payload;

    logger.log("🚀 Starting full deployment pipeline", payload);

    const results: any = {
      deployments: [],
      migrations: null,
      healthCheck: null,
    };

    try {
      // Step 1: Deploy API service
      logger.log("📦 Deploying API service...");
      const apiDeploy = await deployToRender.trigger({
        serviceId: apiServiceId,
        branch,
        clearCache,
      });
      results.deployments.push({
        service: "api",
        ...apiDeploy,
      });

      // Step 2: Deploy worker services
      if (workerServiceIds.length > 0) {
        logger.log(`📦 Deploying ${workerServiceIds.length} worker services...`);
        
        for (const workerId of workerServiceIds) {
          const workerDeploy = await deployToRender.trigger({
            serviceId: workerId,
            branch,
            clearCache,
          });
          results.deployments.push({
            service: `worker-${workerId.slice(-8)}`,
            ...workerDeploy,
          });
        }
      }

      // Step 3: Run migrations if requested
      if (shouldRunMigrations) {
        logger.log("🗄️ Running database migrations...");
        const migrationResult = await runMigrations.trigger({
          serviceId: apiServiceId,
        });
        results.migrations = migrationResult;
      }

      // Step 4: Wait for deployment to be live (simple delay)
      logger.log("⏳ Waiting for services to be live...");
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

      // Step 5: Health check
      if (healthCheckUrl) {
        logger.log("🏥 Running health check...");
        try {
          const healthResponse = await fetch(healthCheckUrl, {
            method: "GET",
            headers: { "Accept": "application/json" },
          });

          const healthData = await healthResponse.json();
          results.healthCheck = {
            success: healthResponse.ok,
            status: healthResponse.status,
            data: healthData,
          };

          if (healthResponse.ok) {
            logger.log("✅ Health check passed", healthData);
          } else {
            logger.error("❌ Health check failed", healthData);
          }
        } catch (error: any) {
          logger.error("❌ Health check error", { error: error.message });
          results.healthCheck = {
            success: false,
            error: error.message,
          };
        }
      }

      logger.log("🎉 Deployment pipeline completed", results);

      return {
        success: true,
        ...results,
      };

    } catch (error: any) {
      logger.error("❌ Deployment pipeline failed", {
        error: error.message,
        results,
      });
      throw error;
    }
  },
});
