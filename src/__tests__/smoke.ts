import { logger } from '../logger';
import 'dotenv/config';
import CursorOfficialApi from '../cursor-official-api';

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    logger.error('❌ CURSOR_API_KEY is not set in environment.');
    process.exitCode = 1;
    return;
  }

  const api = new CursorOfficialApi({ apiKey });

  logger.info('=== Cursor Official API Smoke Test ===');

  // 1) List models
  try {
    logger.info('\n[1] GET /v0/models');
    const modelsResp = await api.listModels();
    logger.info(`✅ Models count: ${modelsResp.models.length}`);
    logger.info(`🔹 First models: ${modelsResp.models.slice(0, 5).join(', ')}`);

    // 1b) Cache check: call again to exercise in-mem cache
    const t1 = Date.now();
    const modelsResp2 = await api.listModels();
    const t2 = Date.now();
    logger.info(`🧠 Models cache hit time: ${t2 - t1}ms (should be small)`);
  } catch (err) {
    logger.error('❌ Failed to list models:', err instanceof Error ? err.message : err);
  }

  // 2) List repositories (may be slow and rate-limited)
  let candidateRepo: string | undefined = undefined;
  try {
    logger.info('\n[2] GET /v0/repositories');
    const reposResp = await api.listRepositories();
    logger.info(`✅ Repositories count: ${reposResp.repositories.length}`);
    if (reposResp.repositories.length > 0) {
      const sample = reposResp.repositories.slice(0, 3).map(r => `${r.owner}/${r.name}`).join(', ');
      logger.info(`🔹 Sample: ${sample}`);
      candidateRepo = reposResp.repositories[0].repository;
    }
  } catch (err) {
    logger.error('⚠️ Repositories fetch issue (ok under strict rate limits):', err instanceof Error ? err.message : err);
  }

  // Prefer TEST_REPOSITORY if provided
  if (process.env.TEST_REPOSITORY) {
    candidateRepo = process.env.TEST_REPOSITORY;
  }

  // 2b) Create agent if we have a repository to target
  if (candidateRepo) {
    try {
      logger.info(`\n[2b] POST /v0/agents (repo: ${candidateRepo})`);
      const useModel = process.env.TEST_MODEL; // optional explicit model
      const enableImage = process.env.ENABLE_IMAGE_TEST === '1';

      // Tiny 1x1 PNG base64
      const tinyPngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg1m8m1UAAAAASUVORK5CYII=';

      const created = await api.createAgent({
        text: 'Smoke test: please do not make any changes; exit quickly if possible.',
        repository: candidateRepo,
        ...(useModel ? { model: useModel } : {}),
        ...(enableImage
          ? {
              images: [
                {
                  data: tinyPngBase64,
                  dimension: { width: 1, height: 1 },
                },
              ],
            }
          : {}),
      });
      logger.info(`✅ Created agent: ${created.id} (status: ${created.status})`);

      // 2c) Fetch agent details
      logger.info(`\n[2c] GET /v0/agents/${created.id}`);
      const got = await api.getAgent(created.id);
      logger.info(`✅ Agent status: ${got.status}`);

      // 2d) Fetch conversation
      logger.info(`\n[2d] GET /v0/agents/${created.id}/conversation`);
      const conv = await api.getConversation(created.id);
      logger.info(`✅ Conversation messages: ${conv.messages.length}`);

      // 2e) Add follow-up
      logger.info(`\n[2e] POST /v0/agents/${created.id}/followup`);
      const updated = await api.addFollowup(
        created.id,
        'Follow-up: continue doing nothing. This is a smoke test.'
      );
      logger.info(`✅ Follow-up accepted for agent: ${updated.id}`);

      // Brief wait then re-check status (non-fatal if unchanged)
      await sleep(3000);
      const got2 = await api.getAgent(created.id);
      logger.info(`🔄 Agent status after follow-up: ${got2.status}`);

      // 2g) Fetch conversation again to see if messages increased
      logger.info(`\n[2g] GET /v0/agents/${created.id}/conversation (after follow-up)`);
      const conv2 = await api.getConversation(created.id);
      logger.info(`✅ Conversation messages after follow-up: ${conv2.messages.length}`);

      // 2f) Delete agent
      logger.info(`\n[2f] DELETE /v0/agents/${created.id}`);
      const del = await api.deleteAgent(created.id);
      logger.info(`✅ Deleted agent: ${del.id}`);
    } catch (err) {
      logger.error('❌ Agent create/get/followup/delete failure:', err instanceof Error ? err.message : err);
    }
  } else {
    logger.info('ℹ️ Skipping agent lifecycle — set TEST_REPOSITORY to enable without listing repositories.');
  }

  // 3) Optional: Get agent by id if provided (no creation)
  const testAgentId = process.env.TEST_AGENT_ID;
  if (testAgentId) {
    try {
      logger.info(`\n[3] GET /v0/agents/${testAgentId}`);
      const agent = await api.getAgent(testAgentId);
      logger.info(`✅ Agent: ${agent.id}, status: ${agent.status}, createdAt: ${agent.createdAt}`);
    } catch (err) {
      logger.error('⚠️ Failed to fetch agent (ensure TEST_AGENT_ID is valid):', err instanceof Error ? err.message : err);
    }
  } else {
    logger.info('\n[3] Skipping GET /v0/agents/{id} — set TEST_AGENT_ID to enable.');
  }

  logger.info('\n=== Smoke test complete ===');
}

main().catch((e) => {
  logger.error('Unexpected error in smoke test:', e);
  process.exitCode = 1;
});
