import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { readBackupFile } from "@/server/backup";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true }
  });
  if (!user || user.status !== "ACTIVE" || user.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const name = url.searchParams.get("name") ?? "";
  if (!name.trim()) return new Response("Missing name", { status: 400 });

  const folderRow = await prisma.setting.findUnique({
    where: { key: "BackupFolder" },
    select: { value: true }
  });
  const folder = folderRow?.value?.trim() || "backups";

  try {
    const { filename, bytes } = await readBackupFile({ folder, name });
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    const blob = new Blob([ab], { type: "application/zip" });
    return new Response(blob, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return new Response(`Cannot read backup: ${String((error as any)?.message || error)}`, { status: 404 });
  }
}
