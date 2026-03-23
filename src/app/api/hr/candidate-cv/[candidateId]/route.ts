import { NextRequest } from "next/server";
import { requireActiveUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { logWarn } from "@/server/log";
import { buildOrgIndex, isAncestorManager, loadOrgUsers } from "@/server/org";
import { getRequestId } from "@/server/request-meta";
import { hasHrAddon } from "@/server/rbac";

export const runtime = "nodejs";

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export async function GET(_req: NextRequest, { params }: { params: { candidateId: string } }) {
  const requestId = getRequestId(_req);
  const actor = await requireActiveUser();
  const candidateId = String(params.candidateId || "").trim();
  if (!candidateId) {
    return new Response("Candidate not found", {
      status: 404,
      headers: { "x-request-id": requestId }
    });
  }

  const candidate = await prisma.hrCandidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      fullName: true,
      cvDriveUrl: true,
      latestCvFileName: true,
      latestCvMimeType: true,
      latestCvData: true,
      applications: {
        select: {
          process: {
            select: {
              openedById: true,
              managerId: true,
              finalApproverId: true
            }
          }
        }
      }
    }
  });

  if (!candidate?.cvDriveUrl && !candidate?.latestCvData) {
    return new Response("CV not found", {
      status: 404,
      headers: { "x-request-id": requestId }
    });
  }

  let canView = hasHrAddon(actor);
  if (!canView) {
    const orgUsers = await loadOrgUsers();
    const { managerOf } = buildOrgIndex(orgUsers);
    canView = candidate.applications.some(({ process }) => {
      if (process.openedById === actor.id || process.managerId === actor.id || process.finalApproverId === actor.id) {
        return true;
      }
      return process.managerId ? isAncestorManager(actor.id, process.managerId, managerOf) : false;
    });
  }

  if (!canView) {
    logWarn("candidate.cv.forbidden", { requestId, actorId: actor.id, candidateId });
    return new Response("Forbidden", {
      status: 403,
      headers: { "x-request-id": requestId }
    });
  }

  if (candidate.cvDriveUrl) {
    return Response.redirect(candidate.cvDriveUrl, 302);
  }
  if (!candidate.latestCvData) {
    return new Response("CV not found", {
      status: 404,
      headers: { "x-request-id": requestId }
    });
  }

  const filenameBase = sanitizeFilename(candidate.latestCvFileName || `${candidate.fullName || "candidate"}-cv.pdf`) || "candidate-cv.pdf";
  const filename = filenameBase.toLowerCase().endsWith(".pdf") ? filenameBase : `${filenameBase}.pdf`;
  const body = new Uint8Array(candidate.latestCvData);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": candidate.latestCvMimeType || "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=60",
      "x-request-id": requestId
    }
  });
}
