import { expandTopics } from "@openscroll/content";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { query = "", language = "en" } = body;

    if (!query.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const expanded = await expandTopics(query.trim(), { language, useLiveApi: true });

    return NextResponse.json({
      version: "1",
      requestId: crypto.randomUUID(),
      data: expanded
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to expand topics", message: error.message },
      { status: 500 }
    );
  }
}
