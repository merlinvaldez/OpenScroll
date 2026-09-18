import { resolveEntity } from "@openscroll/content";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (!query.trim()) {
      return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
    }

    const entity = await resolveEntity(query);

    return NextResponse.json({
      version: "1",
      requestId: crypto.randomUUID(),
      data: {
        query,
        entity
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to resolve entity", message: error.message },
      { status: Number.isInteger(error?.status) ? error.status : 500 }
    );
  }
}
