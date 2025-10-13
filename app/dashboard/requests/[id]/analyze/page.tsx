"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSubscriptionEntitlements } from "@/hooks/use-subscription-entitlements"
import { isChangeOrderLimitReached } from "@/lib/subscriptions/permissions"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react"

interface Analysis {
  isOutOfScope: boolean
  reasoning: string
  estimatedHours: number
  suggestedTasks: string[]
  riskLevel: "low" | "medium" | "high"
}

export default function AnalyzeRequestPage() {
  const [request, setRequest] = useState<any>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const {
    entitlements,
    monthlyChangeOrderCount,
    isLoading: isEntitlementsLoading,
    error: entitlementsError,
  } = useSubscriptionEntitlements({ includeMonthlyChangeOrderCount: true })

  const changeOrderLimitReached = isChangeOrderLimitReached(monthlyChangeOrderCount, entitlements)
  const remainingChangeOrders =
    entitlements && entitlements.maxMonthlyChangeOrders !== null && typeof monthlyChangeOrderCount === "number"
      ? Math.max(entitlements.maxMonthlyChangeOrders - monthlyChangeOrderCount, 0)
      : null

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const { data, error } = await supabase
          .from("requests")
          .select("*, projects(name, client_name)")
          .eq("id", params.id)
          .single()

        if (error) throw error
        setRequest(data)

        // If already analyzed, show the analysis
        if (data.analysis) {
          setAnalysis(data.analysis as Analysis)
        } else {
          // Auto-start analysis
          analyzeRequest(data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load request")
      }
    }

    fetchRequest()
  }, [params.id, supabase])

  const analyzeRequest = async (requestData: any) => {
    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch("/api/analyze-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestData.id,
          clientMessage: requestData.client_message,
          projectName: requestData.projects?.name,
        }),
      })

      if (!response.ok) throw new Error("Analysis failed")

      const result = await response.json()
      setAnalysis(result.analysis)

      // Update request with analysis
      await supabase
        .from("requests")
        .update({
          analysis: result.analysis,
          status: "analyzed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestData.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze request")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCreateChangeOrder = async () => {
    if (!analysis || !request) return

    if (isEntitlementsLoading) {
      setError("Please wait a moment while we verify your subscription details.")
      return
    }

    if (isChangeOrderLimitReached(monthlyChangeOrderCount, entitlements)) {
      setError("You've reached the monthly change order limit for your plan. Visit Settings to upgrade for more.")
      return
    }

    try {
      setError(null)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Fetch user's hourly rate
      const { data: userData } = await supabase.from("users").select("hourly_rate").eq("id", user.id).single()

      const hourlyRate = userData?.hourly_rate || 100
      const estimatedCost = analysis.estimatedHours * hourlyRate

      // Create change order
      const { data: changeOrder, error: insertError } = await supabase
        .from("change_orders")
        .insert({
          user_id: user.id,
          request_id: request.id,
          project_id: request.project_id,
          title: `Change Order - ${request.projects?.name || "Request"}`,
          description: analysis.suggestedTasks.join("\n"),
          estimated_hours: analysis.estimatedHours,
          estimated_cost: estimatedCost,
          reply_message: "", // Will be filled in next step
          status: "draft",
        })
        .select()
        .single()

      if (insertError) throw insertError

      router.push(`/dashboard/change-orders/${changeOrder.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create change order")
    }
  }

  if (!request && !error) {
    return (
      <div className="container mx-auto max-w-4xl space-y-8 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Request Analysis</h1>
        <p className="text-muted-foreground">AI-powered scope analysis</p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {request && (
        <Card>
          <CardHeader>
            <CardTitle>Client Message</CardTitle>
            {request.projects && (
              <CardDescription>
                Project: {request.projects.name} - {request.projects.client_name}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4">
              <p className="whitespace-pre-wrap text-sm">{request.client_message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isAnalyzing && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing request with AI...</p>
          </CardContent>
        </Card>
      )}

      {analysis && !isAnalyzing && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Analysis Results</CardTitle>
                <div
                  className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                    analysis.isOutOfScope
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                      : "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  }`}
                >
                  {analysis.isOutOfScope ? (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      Out of Scope
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      In Scope
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="mb-2 font-semibold">Reasoning</h3>
                <p className="text-sm text-muted-foreground">{analysis.reasoning}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Estimated Hours</p>
                    <p className="text-2xl font-bold">{analysis.estimatedHours}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Risk Level</p>
                    <p className="text-2xl font-bold capitalize">{analysis.riskLevel}</p>
                  </div>
                </div>
              </div>

              {analysis.suggestedTasks.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold">Suggested Tasks</h3>
                  <ul className="space-y-2">
                    {analysis.suggestedTasks.map((task, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {analysis.isOutOfScope && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-4">
                <Button
                  onClick={handleCreateChangeOrder}
                  size="lg"
                  className="flex-1"
                  disabled={isEntitlementsLoading || changeOrderLimitReached}
                >
                  {isEntitlementsLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking plan...
                    </>
                  ) : (
                    "Create Change Order"
                  )}
                </Button>
                <Button variant="outline" onClick={() => router.push("/dashboard")} size="lg">
                  Back to Dashboard
                </Button>
              </div>
              {entitlements && entitlements.maxMonthlyChangeOrders !== null && (
                <p className="text-sm text-muted-foreground">
                  {changeOrderLimitReached
                    ? "You've used all change orders included in your plan this month."
                    : `${remainingChangeOrders ?? 0} change ${
                        (remainingChangeOrders ?? 0) === 1 ? "order" : "orders"
                      } left this month on your plan.`}
                </p>
              )}
              {entitlementsError && (
                <p className="text-sm text-destructive">{entitlementsError}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
