"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"

export default function NewRequestPage() {
  const [projects, setProjects] = useState<Array<{ id: string; name: string; client_name: string }>>([])
  const [projectId, setProjectId] = useState("")
  const [clientMessage, setClientMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingProjects, setIsFetchingProjects] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from("projects")
          .select("id, name, client_name")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("name")

        if (error) throw error
        setProjects(data || [])
      } catch (err) {
        console.error("Error fetching projects:", err)
      } finally {
        setIsFetchingProjects(false)
      }
    }

    fetchProjects()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Create the request
      const { data: request, error: insertError } = await supabase
        .from("requests")
        .insert({
          user_id: user.id,
          project_id: projectId || null,
          client_message: clientMessage,
          status: "pending",
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Redirect to analysis page
      router.push(`/dashboard/requests/${request.id}/analyze`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Request</h1>
        <p className="text-muted-foreground">Analyze a client request for scope changes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Details</CardTitle>
          <CardDescription>Enter the client&apos;s message to analyze if it&apos;s out of scope</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="project">Project (Optional)</Label>
              {isFetchingProjects ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading projects...
                </div>
              ) : (
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger id="project">
                    <SelectValue placeholder="Select a project or leave blank" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} - {project.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Client Message</Label>
              <Textarea
                id="message"
                placeholder="Paste the client's request here... For example: 'Hey, can we add a contact form to the homepage? Also, I'd like to change the color scheme to match our new branding.'"
                value={clientMessage}
                onChange={(e) => setClientMessage(e.target.value)}
                rows={8}
                required
              />
              <p className="text-xs text-muted-foreground">
                Paste the full message from your client that you want to analyze
              </p>
            </div>

            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading || isFetchingProjects} className="flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Analyze Request"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
