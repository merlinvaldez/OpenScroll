import { FileFeedContinuationStore } from "../packages/content/src/feed-continuation.js";

async function main() {
  const store = new FileFeedContinuationStore();
  const dir = store.storeDir;

  const { prunedCount, activeCount } = await store.prune();
  console.log(`Feed continuation store migrated and verified at: ${dir}`);
  console.log(`  Active sessions: ${activeCount}`);
  console.log(`  Pruned expired sessions: ${prunedCount}`);
}

main().catch((err) => {
  console.error("Failed to migrate feed continuation store:", err);
  process.exit(1);
});

