import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { cache } from "react";
import { prisma } from "./db";
import { authOptions } from "./auth";
import { hasAdminAddon } from "./rbac";

const getUserById = cache((userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      position: true,
      role: true,
      hrAddon: true,
      adminAddon: true,
      status: true,
      carryOverAnnualLeave: true,
      annualLeaveDays: true,
      homeOfficeDays: true,
      slavaDays: true,
      employmentDate: true,
      jobDescriptionUrl: true,
      workInstructionsUrl: true,
      teamId: true,
      managerId: true,
      createdAt: true,
      updatedAt: true,
      team: { select: { id: true, name: true } }
    }
  })
);

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;
  return getUserById(userId);
}

export async function requireActiveUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/login");
  return user;
}

export async function requireAdminUser() {
  const user = await requireActiveUser();
  if (!hasAdminAddon(user)) redirect("/dashboard");
  return user;
}
