import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Agent name is required" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File must be a PNG, JPEG, or WebP image" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File must be under 2MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extMap: Record<string, string> = {
      "image/png": "png",
      "image/webp": "webp",
      "image/jpeg": "jpeg",
    };
    const ext = extMap[file.type] || "png";
    const filename = `${name.trim().toLowerCase()}.${ext}`;
    const avatarsDir = path.join(process.cwd(), "public", "avatars");

    await mkdir(avatarsDir, { recursive: true });
    await writeFile(path.join(avatarsDir, filename), buffer);

    return NextResponse.json({
      success: true,
      url: `/avatars/${filename}`,
    });
  } catch (error) {
    console.error("[Avatar Upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}
