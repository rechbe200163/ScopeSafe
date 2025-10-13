import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { FileText, Download, Eye } from "lucide-react"

export default async function HistoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch all requests
  const { data: requests } = await supabase
    .from("requests")
    .select("*, projects(name, client_name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  // Fetch all change orders
  const { data: changeOrders } = await supabase
    .from("change_orders")
    .select("*, requests(client_message, projects(name, client_name))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="container mx-auto max-w-7xl space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground">View all your requests and change orders</p>
      </div>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="change-orders">Change Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-6">
          {requests && requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {request.projects?.name || "No Project"} - Request #{request.id.slice(0, 8)}
                        </CardTitle>
                        <CardDescription>
                          {request.projects?.client_name && `Client: ${request.projects.client_name} • `}
                          {new Date(request.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          request.status === "analyzed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                            : request.status === "pending"
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400"
                        }`}
                      >
                        {request.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{request.client_message}</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/requests/${request.id}/analyze`}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No requests yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="change-orders" className="mt-6">
          {changeOrders && changeOrders.length > 0 ? (
            <div className="space-y-4">
              {changeOrders.map((order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{order.title}</CardTitle>
                        <CardDescription>
                          {order.requests?.projects?.client_name && `Client: ${order.requests.projects.client_name} • `}
                          {new Date(order.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          order.status === "sent"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                            : order.status === "accepted"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                              : order.status === "rejected"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Hours:</span>{" "}
                        <span className="font-medium">{order.estimated_hours}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cost:</span>{" "}
                        <span className="font-medium">${order.estimated_cost}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/change-orders/${order.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/api/generate-pdf/${order.id}`} target="_blank">
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No change orders yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
