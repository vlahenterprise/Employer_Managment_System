import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { prisma } from "./db";
import { authOptions } from "./auth";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      position: true,
      role: true,
      status: true,
      carryOverAnnualLeave: true,
      teamId: true,
      managerId: true,
      createdAt: true,
      updatedAt: true,
      team: { select: { id: true, name: true } }
    }
  });
}

export async function requireActiveUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/login");
  return user;
}

export async function requireAdminUser() {
  const user = await requireActiveUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
