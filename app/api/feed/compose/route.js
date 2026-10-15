import { composeSearchFeed } from "@openscroll/content";
import { NextResponse } from "next/server";

function onMetrics(metrics) {
  if (process.env.FEED_METRICS_LOG === "1") console.info(JSON.stringify({ event: "feed.metrics", ...metrics }));
}

function streamResponse(body) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload) => controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      Promise.resolve().then(async () => {
        try {
          const data = await composeSearchFeed(body, { onMetrics, onProgress: (progress) => send({ type: "progress", ...progress }) });
          send({ type: "result", payload: { version: "1", requestId: crypto.randomUUID(), data } });
        } catch (error) {
          send({
            type: "error",
            error: error.message,
            code: error.code || (error.status === 400 ? "INVALID_REQUEST" : error.status === 410 ? "CONTINUATION_EXPIRED" : "FEED_ERROR"),
            status: error.status || 500,
            canRestart: Boolean(error.canRestart)
          });
        } finally {
          controller.close();
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no"
    }
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (request.headers.get("accept")?.includes("application/x-ndjson")) return streamResponse(body);
    const data = await composeSearchFeed(body, { onMetrics });
    return NextResponse.json({ version: "1", requestId: crypto.randomUUID(), data });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    const isClientError = status === 400 || status === 410;
    return NextResponse.json(
      {
        error: isClientError ? error.message : "Failed to compose feed",
        message: error.message,
        code: error.code || (status === 400 ? "INVALID_REQUEST" : status === 410 ? "CONTINUATION_EXPIRED" : "FEED_ERROR"),
        canRestart: Boolean(error.canRestart)
      },
      { status }
    );
  }
}
