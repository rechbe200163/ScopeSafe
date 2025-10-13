import type React from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardNav } from "@/components/dashboard-nav"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("users")
    .select("name, subscription_tier, subscription_status")
    .eq("id", user.id)
    .single()

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardNav
        userName={profile?.name || user.email || undefined}
        subscriptionTier={(profile?.subscription_tier as string) || "free"}
        subscriptionStatus={(profile?.subscription_status as string | null) ?? null}
      />
      <main className="flex-1 bg-muted/30">{children}</main>
    </div>
  )
}
