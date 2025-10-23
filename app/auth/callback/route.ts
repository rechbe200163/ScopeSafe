import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const nextParam = requestUrl.searchParams.get("next")
  const providerError = requestUrl.searchParams.get("error_description")

  const sanitizedNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard"

  let authError = providerError

  if (code && !authError) {
    try {
      const supabase = await createClient()
      await supabase.auth.exchangeCodeForSession(code)
    } catch (error: unknown) {
      authError = error instanceof Error ? error.message : "Unable to complete authentication"
    }
  }

  const redirectPath = authError ? "/auth/login" : sanitizedNext
  const redirectUrl = new URL(redirectPath, requestUrl.origin)

  if (authError) {
    redirectUrl.searchParams.set("authError", authError)
    redirectUrl.searchParams.set("redirectTo", sanitizedNext)
  }

  return NextResponse.redirect(redirectUrl)
}
