import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import { Plus, FileText, FolderOpen, TrendingUp } from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch statistics
  const [
    { count: projectCount },
    { count: requestCount },
    { count: changeOrderCount },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('change_orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ]);

  // Fetch recent requests
  const { data: recentRequests } = await supabase
    .from('requests')
    .select('*, projects(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div className='container mx-auto max-w-7xl space-y-8 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Dashboard</h1>
          <p className='text-muted-foreground'>
            Manage your projects and change orders
          </p>
        </div>
        <Button asChild size='lg'>
          <Link href='/dashboard/new-request'>
            <Plus className='mr-2 h-5 w-5' />
            New Request
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Projects
            </CardTitle>
            <FolderOpen className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{projectCount || 0}</div>
            <p className='text-xs text-muted-foreground'>
              Active client projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Requests
            </CardTitle>
            <FileText className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{requestCount || 0}</div>
            <p className='text-xs text-muted-foreground'>
              Client requests analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Change Orders</CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{changeOrderCount || 0}</div>
            <p className='text-xs text-muted-foreground'>
              Generated change orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
          <CardDescription>
            Your latest client requests and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentRequests && recentRequests.length > 0 ? (
            <div className='space-y-4'>
              {recentRequests.map((request) => (
                <div
                  key={request.id}
                  className='flex items-center justify-between rounded-lg border p-4'
                >
                  <div className='flex-1'>
                    <p className='font-medium'>
                      {request.projects?.name || 'No Project'} - Request #
                      {request.id.slice(0, 8)}
                    </p>
                    <p className='text-sm text-muted-foreground line-clamp-1'>
                      {request.client_message}
                    </p>
                  </div>
                  <div className='flex items-center gap-4'>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        request.status === 'analyzed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : request.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                      }`}
                    >
                      {request.status}
                    </span>
                    <Button variant='outline' size='sm' asChild>
                      <Link href={`/dashboard/requests/${request.id}/analyze`}>
                        View
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <FileText className='mb-4 h-12 w-12 text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>
                No requests yet. Create your first request to get started.
              </p>
              <Button asChild className='mt-4'>
                <Link href='/dashboard/new-request'>Create Request</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
