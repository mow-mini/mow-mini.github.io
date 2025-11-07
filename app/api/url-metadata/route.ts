import { NextRequest, NextResponse } from "next/server";
import { sanitizeHttpUrl } from "@lib/utils";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const urlParam = request.nextUrl.searchParams.get("url");
  const sanitizedUrl = sanitizeHttpUrl(urlParam ?? "");

  if (!sanitizedUrl) {
    return NextResponse.json(
      { error: "Invalid URL provided." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(sanitizedUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "mow-shortcuts-metadata-fetcher/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to load ${sanitizedUrl}` },
        { status: response.status }
      );
    }

    const rawText = await response.text();
    const snippet = rawText.slice(0, 50000);
    const titleMatch = snippet.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? "";

    return NextResponse.json({
      title,
      url: response.url ?? sanitizedUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch metadata." },
      { status: 500 }
    );
  }
}
