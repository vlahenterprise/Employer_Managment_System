import { redirect } from "next/navigation";
import { requireAdminUser } from "@/server/current-user";

export default async function AdminPage() {
  await requireAdminUser();
  redirect("/admin/users");
}

