import { createUniversalContentObject, fetchWikipediaArticleLive } from "@openscroll/content";
import { NextResponse } from "next/server";

export async function GET(request) {
  const url = new URL(request.url);
  const source = url.searchParams.get("source") || "wikipedia";
  const title = url.searchParams.get("title") || "";

  if (source !== "wikipedia" || !title.trim()) {
    return NextResponse.json({ error: "A Wikipedia article title is required" }, { status: 400 });
  }

  const record = await fetchWikipediaArticleLive(title);
  if (!record) {
    return NextResponse.json({ error: "The full article could not be loaded" }, { status: 404 });
  }

  const item = createUniversalContentObject(record, { ingestRunId: "live: wikipedia-article" });
  return NextResponse.json({
    version: "1",
    requestId: crypto.randomUUID(),
    data: {
      item,
      canonicalUrl: item.canonicalUrl,
      attribution: item.rights.attributionNotice.text,
      rightsSnapshot: item.rights.whyOpen
    }
  });
}
