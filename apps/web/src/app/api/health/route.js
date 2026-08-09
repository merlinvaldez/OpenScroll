import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    version: "1",
    requestId: crypto.randomUUID(),
    data: {
      status: "ok",
      epic: "OS-001—OS-008",
      accounts: false,
      userGeneratedContent: false
    }
  });
}
