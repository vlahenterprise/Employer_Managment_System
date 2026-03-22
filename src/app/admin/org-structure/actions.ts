"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { ORG_STRUCTURE_CACHE_TAG } from "@/server/cache-tags";
import { prisma } from "@/server/db";
import { requireAdminUser } from "@/server/current-user";
import { importVlahOrgTemplate } from "@/server/org-template-vlah";
import type { OrgLinkType, OrgPositionTier } from "@prisma/client";

function redirectError(message: string): never {
  redirect(`/admin/org-structure?error=${encodeURIComponent(message)}`);
}

function redirectSuccess(message: string): never {
  redirect(`/admin/org-structure?success=${encodeURIComponent(message)}`);
}

function revalidateOrgStructureData() {
  revalidateTag(ORG_STRUCTURE_CACHE_TAG);
}

function revalidateOrgPages() {
  revalidatePath("/admin/org-structure");
  revalidatePath("/organization");
  revalidatePath("/profile");
  revalidatePath("/onboarding");
  revalidateOrgStructureData();
}

function normalizeOrgLinkType(value: FormDataEntryValue | null): OrgLinkType {
  const type = String(value ?? "").trim().toUpperCase();
  if (
    type === "JOB_DESCRIPTION" ||
    type === "WORK_INSTRUCTIONS" ||
    type === "POSITION_PROCESS" ||
    type === "POSITION_INSTRUCTION" ||
    type === "GLOBAL_PROCESS" ||
    type === "GLOBAL_INSTRUCTION"
  ) {
    return type;
  }
  return "POSITION_INSTRUCTION";
}

function normalizeOrgTier(value: FormDataEntryValue | null): OrgPositionTier {
  const tier = String(value ?? "").trim().toUpperCase();
  if (tier === "DIRECTOR" || tier === "MANAGER" || tier === "LEAD" || tier === "SUPERVISOR" || tier === "STAFF") {
    return tier;
  }
  return "STAFF";
}

export async function createOrgPositionAction(formData: FormData) {
  await requireAdminUser();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw || null;
  const tier = normalizeOrgTier(formData.get("tier"));
  const order = Math.max(0, Math.floor(Number(formData.get("order") ?? 0)));
  const isActive = String(formData.get("isActive") ?? "1") === "1";

  if (!title) redirectError("Naziv pozicije je obavezan.");

  await prisma.orgPosition.create({
    data: { title, description, parentId, tier, order, isActive }
  });

  revalidateOrgPages();
  redirectSuccess("Pozicija je kreirana.");
}

export async function updateOrgPositionAction(formData: FormData) {
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw || null;
  const tier = normalizeOrgTier(formData.get("tier"));
  const order = Math.max(0, Math.floor(Number(formData.get("order") ?? 0)));
  const isActive = String(formData.get("isActive") ?? "1") === "1";

  if (!id) redirectError("Nedostaje ID pozicije.");
  if (!title) redirectError("Naziv pozicije je obavezan.");
  if (parentId && parentId === id) redirectError("Pozicija ne može biti sama sebi roditelj.");

  await prisma.orgPosition.update({
    where: { id },
    data: { title, description, parentId, tier, order, isActive }
  });

  revalidateOrgPages();
  redirectSuccess("Pozicija je sačuvana.");
}

export async function deleteOrgPositionAction(formData: FormData) {
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirectError("Nedostaje ID pozicije.");

  await prisma.orgPosition.delete({ where: { id } });

  revalidateOrgPages();
  redirectSuccess("Pozicija je obrisana.");
}

export async function addOrgLinkAction(formData: FormData) {
  await requireAdminUser();

  const positionId = String(formData.get("positionId") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim();
  const type = normalizeOrgLinkType(formData.get("type"));
  const order = Math.max(0, Math.floor(Number(formData.get("order") ?? 0)));

  if (!positionId) redirectError("Nedostaje positionId.");
  if (!label || !url) redirectError("Link label i URL su obavezni.");

  await prisma.orgPositionLink.create({
    data: { positionId, label, description, url, type, order }
  });

  revalidateOrgPages();
  redirectSuccess("Link je dodat.");
}

export async function addOrgGlobalLinkAction(formData: FormData) {
  await requireAdminUser();

  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim();
  const type = normalizeOrgLinkType(formData.get("type"));
  const order = Math.max(0, Math.floor(Number(formData.get("order") ?? 0)));

  if (!label || !url) redirectError("Naziv i URL globalnog resursa su obavezni.");
  if (!String(type).startsWith("GLOBAL_")) redirectError("Globalni resurs mora biti globalnog tipa.");

  await prisma.orgGlobalLink.create({
    data: { label, description, url, type, order }
  });

  revalidateOrgPages();
  redirectSuccess("Globalni resurs je dodat.");
}

export async function deleteOrgLinkAction(formData: FormData) {
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirectError("Nedostaje link ID.");

  await prisma.orgPositionLink.delete({ where: { id } });

  revalidateOrgPages();
  redirectSuccess("Link je obrisan.");
}

export async function deleteOrgGlobalLinkAction(formData: FormData) {
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirectError("Nedostaje globalni link ID.");

  await prisma.orgGlobalLink.delete({ where: { id } });

  revalidateOrgPages();
  redirectSuccess("Globalni resurs je obrisan.");
}

export async function addOrgAssignmentAction(formData: FormData) {
  await requireAdminUser();

  const positionId = String(formData.get("positionId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!positionId || !userId) redirectError("Nedostaje positionId ili userId.");

  await prisma.orgPositionAssignment.create({
    data: { positionId, userId }
  });

  revalidateOrgPages();
  redirectSuccess("Zaposleni je dodat na poziciju.");
}

export async function removeOrgAssignmentAction(formData: FormData) {
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirectError("Nedostaje assignment ID.");

  await prisma.orgPositionAssignment.delete({ where: { id } });

  revalidateOrgPages();
  redirectSuccess("Zaposleni je uklonjen sa pozicije.");
}

export async function importDefaultOrgStructureAction() {
  await requireAdminUser();

  const result = await importVlahOrgTemplate();
  if (result.skippedExisting) {
    redirectError("Org struktura već postoji. Uvoz je blokiran da ne prepiše postojeće podatke.");
  }

  revalidateOrgPages();

  redirectSuccess(`VLAH org struktura je uvezena. Pozicije: ${result.positionsCreated}, dodele: ${result.assignmentsCreated}.`);
}
