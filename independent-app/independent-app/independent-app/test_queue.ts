import { DbService } from "./src/lib/supabase-service";
(async () => {
  try {
    const queue = await DbService.getReviewQueue();
    console.log(JSON.stringify(queue.map(q => ({id: q.id, type: q.proofType, url: q.proofUrl})), null, 2));
  } catch (e) {
    console.error("ERROR", e);
  }
})();
