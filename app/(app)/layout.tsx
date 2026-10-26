import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataProvider } from "@/components/DataProvider";
import { AppShell } from "@/components/AppShell";
import type { Profile } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = me as Profile | null;
  if (!profile || !profile.active || profile.role === "driver") {
    return (
      <main className="login">
        <div className="login-card">
          <p>{profile?.role === "driver"
            ? "Кабінет водія ще в розробці. Документи й чеки поки надсилайте диспетчеру."
            : "Ваш обліковий запис не активний. Зверніться до власника фірми."}</p>
        </div>
      </main>
    );
  }

  return (
    <DataProvider me={profile}>
      <AppShell>{children}</AppShell>
    </DataProvider>
  );
}
