import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/current-user";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user && user.status === "ACTIVE" ? "/dashboard" : "/login");
}
