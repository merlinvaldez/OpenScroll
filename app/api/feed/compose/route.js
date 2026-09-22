import { composeSearchFeed } from "@openscroll/content";
import { NextResponse } from "next/server";

function streamResponse(body) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload) => controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      Promise.resolve().then(async () => {
        try {
          const data = await composeSearchFeed(body, { onProgress: (progress) => send({ type: "progress", ...progress }) });
          send({ type: "result", payload: { version: "1", requestId: crypto.randomUUID(), data } });
        } catch (error) {
          send({ type: "error", error: error.message, status: error.status || 500 });
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
    const data = await composeSearchFeed(body);
    return NextResponse.json({ version: "1", requestId: crypto.randomUUID(), data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error.status === 400 ? error.message : "Failed to compose feed",
        message: error.message
      },
      { status: Number.isInteger(error?.status) ? error.status : 500 }
    );
  }
}
