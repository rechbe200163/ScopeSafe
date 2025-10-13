"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSubscriptionEntitlements } from "@/hooks/use-subscription-entitlements"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Loader2, FileText, Download, Send } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function ChangeOrderPage() {
  const [changeOrder, setChangeOrder] = useState<any>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [estimatedHours, setEstimatedHours] = useState("")
  const [estimatedCost, setEstimatedCost] = useState("")
  const [replyMessage, setReplyMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const {
    entitlements,
    isLoading: isEntitlementsLoading,
    error: entitlementsError,
  } = useSubscriptionEntitlements()

  useEffect(() => {
    const fetchChangeOrder = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from("change_orders")
          .select("*, requests(client_message, projects(name, client_name))")
          .eq("id", params.id)
          .single()

        if (error) throw error

        setChangeOrder(data)
        setTitle(data.title)
        setDescription(data.description)
        setEstimatedHours(data.estimated_hours.toString())
        setEstimatedCost(data.estimated_cost.toString())
        setReplyMessage(data.reply_message || "")

        // Generate default reply if empty
        if (!data.reply_message) {
          generateReply(data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load change order")
      } finally {
        setIsLoading(false)
      }
    }

    fetchChangeOrder()
  }, [params.id, supabase])

  const generateReply = async (orderData: any) => {
    try {
      const clientName = orderData.requests?.projects?.client_name || "Client"
      const projectName = orderData.requests?.projects?.name || "your project"

      const defaultReply = `Hi ${clientName},

Thank you for your request regarding ${projectName}. After reviewing your message, I've determined that this work falls outside the original project scope.

Here's what would be involved:

${orderData.description}

Estimated Time: ${orderData.estimated_hours} hours
Estimated Cost: $${orderData.estimated_cost}

I've prepared a detailed change order for your review. Please let me know if you have any questions or would like to proceed.

Best regards`

      setReplyMessage(defaultReply)
    } catch (err) {
      console.error("Failed to generate reply:", err)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from("change_orders")
        .update({
          title,
          description,
          estimated_hours: Number.parseFloat(estimatedHours),
          estimated_cost: Number.parseFloat(estimatedCost),
          reply_message: replyMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id)

      if (updateError) throw updateError

      router.push("/dashboard/history")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save change order")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendEmail = async () => {
    if (!params?.id) return
    if (isEntitlementsLoading) {
      toast.info("Checking your plan details. Please try again in a moment.")
      return
    }
    if (!entitlements?.canSendEmails) {
      toast.error("Automatic emails are unavailable on your current plan.")
      return
    }
    setIsSending(true)
    try {
      const response = await fetch(`/api/change-orders/${params.id}/send`, {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || "Failed to send change order email")
      }

      toast.success("Change order email sent to the client")
      setChangeOrder((prev: any) => (prev ? { ...prev, status: "sent" } : prev))
    } catch (err) {
      console.error("Send email error:", err)
      const message = err instanceof Error ? err.message : "Failed to send change order email"
      toast.error(message)
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Change Order</h1>
          <p className="text-muted-foreground">Review and customize your change order</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/api/generate-pdf/${params.id}`} target="_blank">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Link>
            </Button>
            <Button
              variant="default"
              onClick={handleSendEmail}
              disabled={isSending || isEntitlementsLoading || !entitlements?.canSendEmails}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send to Client
                </>
              )}
            </Button>
          </div>
          {!isEntitlementsLoading && entitlements && !entitlements.canSendEmails && (
            <p className="text-xs text-muted-foreground">
              Email delivery is available on Pro plans. Download the PDF to share it manually.
            </p>
          )}
          {entitlementsError && <p className="text-xs text-destructive">{entitlementsError}</p>}
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {changeOrder && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Original Request</CardTitle>
              {changeOrder.requests?.projects && (
                <CardDescription>
                  Project: {changeOrder.requests.projects.name} - {changeOrder.requests.projects.client_name}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4">
                <p className="whitespace-pre-wrap text-sm">{changeOrder.requests?.client_message}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Order Details</CardTitle>
              <CardDescription>Customize the details before sending to your client</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description / Tasks</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hours">Estimated Hours</Label>
                  <Input
                    id="hours"
                    type="number"
                    step="0.5"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost">Estimated Cost ($)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reply Message</CardTitle>
              <CardDescription>Customize the message to send to your client</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button onClick={handleSave} disabled={isSaving} size="lg" className="flex-1">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Save Change Order
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => router.back()} disabled={isSaving} size="lg">
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
