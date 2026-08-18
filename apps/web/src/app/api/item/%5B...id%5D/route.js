import { EPIC_C_RAW_ITEMS, createUniversalContentObject } from "@openscroll/content";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const idParts = resolvedParams.id || [];
  const fullKey = idParts.join("/");

  // Search by exact ID or matching parts
  const record = EPIC_C_RAW_ITEMS.find((item) => {
    return (
      item.id === fullKey ||
      item.id === idParts[idParts.length - 1] ||
      item.sourceItemId === fullKey ||
      (item.sourceId === idParts[0] && item.sourceItemId === idParts.slice(1).join("/"))
    );
  });

  if (!record) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const uco = createUniversalContentObject(record);

  return NextResponse.json({
    version: "1",
    requestId: crypto.randomUUID(),
    data: {
      item: uco,
      canonicalUrl: uco.canonicalUrl,
      attribution: uco.rights.attributionNotice.text,
      rightsSnapshot: uco.rights.whyOpen
    }
  });
}
