import { NextResponse } from "next/server";
import { generateAgentData } from "@/lib/mockData";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  const data = generateAgentData(query);
  if (!data) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}
