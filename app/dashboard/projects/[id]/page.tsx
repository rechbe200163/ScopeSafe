import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Plus, FileText, DollarSign, Clock } from 'lucide-react';
import { notFound } from 'next/navigation';
import { ProjectEditForm } from '@/components/project-edit-form';
import { ChangeOrdersList } from '@/components/change-orders-list';
import { getSubscriptionEntitlements } from '@/lib/subscriptions/permissions';
import { SubscriptionTier } from '@/lib/subscriptions/plans';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('subscription_tier, subscription_status')
    .eq('id', user?.id)
    .single();

  const entitlements = getSubscriptionEntitlements(
    profile?.subscription_tier as SubscriptionTier | null | undefined,
    profile?.subscription_status as string | null | undefined
  );

  // Fetch project details
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!project) {
    notFound();
  }

  // Fetch all requests for this project
  const { data: requests } = await supabase
    .from('requests')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false });

  const requestIds = requests?.map((r) => r.id) || [];
  const { data: changeOrders } = await supabase
    .from('change_orders')
    .select('*, requests(client_message, created_at)')
    .in('request_id', requestIds)
    .order('created_at', { ascending: false });

  // Calculate statistics
  const totalRequests = requests?.length || 0;
  const pendingRequests =
    requests?.filter((r) => r.status === 'pending').length || 0;
  const analyzedRequests =
    requests?.filter((r) => r.status === 'analyzed').length || 0;
  const totalEstimatedHours =
    changeOrders?.reduce((sum, r) => sum + (r.estimated_hours || 0), 0) || 0;
  const totalEstimatedCost = totalEstimatedHours * (project.hourly_rate || 0);

  return (
    <div className='container mx-auto max-w-7xl space-y-8 p-6'>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/dashboard/projects'>
            <ArrowLeft className='h-5 w-5' />
          </Link>
        </Button>
        <div className='flex-1'>
          <h1 className='text-3xl font-bold tracking-tight'>{project.name}</h1>
          <p className='text-muted-foreground'>Client: {project.client_name}</p>
        </div>
        <Badge
          variant={
            project.status === 'active'
              ? 'default'
              : project.status === 'completed'
              ? 'secondary'
              : 'outline'
          }
        >
          {project.status}
        </Badge>
      </div>

      {/* Project Details */}
      <div className='grid gap-6 md:grid-cols-3'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Requests
            </CardTitle>
            <FileText className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalRequests}</div>
            <p className='text-xs text-muted-foreground'>
              {pendingRequests} pending, {analyzedRequests} analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Estimated Hours
            </CardTitle>
            <Clock className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {totalEstimatedHours.toFixed(1)}h
            </div>
            <p className='text-xs text-muted-foreground'>Across all requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Estimated Cost
            </CardTitle>
            <DollarSign className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              ${totalEstimatedCost.toFixed(2)}
            </div>
            <p className='text-xs text-muted-foreground'>
              At ${project.hourly_rate || 0}/hr
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project Information */}
      <ProjectEditForm project={project} />

      {/* <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {project.description && (
            <div>
              <h3 className='mb-1 text-sm font-medium'>Description</h3>
              <p className='text-sm text-muted-foreground'>
                {project.description}
              </p>
            </div>
          )}
          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <h3 className='mb-1 text-sm font-medium'>Budget</h3>
              <p className='text-sm text-muted-foreground'>
                ${project.budget ? project.budget.toFixed(2) : 'Not set'}
              </p>
            </div>
            <div>
              <h3 className='mb-1 text-sm font-medium'>Hourly Rate</h3>
              <p className='text-sm text-muted-foreground'>
                $
                {project.hourly_rate
                  ? project.hourly_rate.toFixed(2)
                  : 'Not set'}
                /hr
              </p>
            </div>
          </div>
        </CardContent>
      </Card> */}

      <ChangeOrdersList changeOrders={changeOrders || []} />

      {/* Requests Section */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold'>Requests</h2>
          <Button asChild>
            <Link href={`/dashboard/new-request?project=${project.id}`}>
              <Plus className='mr-2 h-4 w-4' />
              New Request
            </Link>
          </Button>
        </div>

        {requests && requests.length > 0 ? (
          <div className='space-y-4'>
            {requests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <CardTitle className='text-lg'>
                        Request from{' '}
                        {new Date(request.created_at).toLocaleDateString()}
                      </CardTitle>
                      <CardDescription className='mt-1 line-clamp-2'>
                        {request.client_message}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        request.status === 'pending'
                          ? 'outline'
                          : request.status === 'analyzed'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {request.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='flex items-center justify-between'>
                    <div className='flex gap-4 text-sm text-muted-foreground'>
                      {request.estimated_hours && (
                        <span className='flex items-center gap-1'>
                          <Clock className='h-4 w-4' />
                          {request.estimated_hours}h
                        </span>
                      )}
                      {request.estimated_cost && (
                        <span className='flex items-center gap-1'>
                          <DollarSign className='h-4 w-4' />$
                          {request.estimated_cost.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <Button variant='outline' size='sm' asChild>
                      <Link href={`/dashboard/requests/${request.id}`}>
                        View Details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
              <FileText className='mb-4 h-12 w-12 text-muted-foreground' />
              <p className='mb-2 text-lg font-medium'>No requests yet</p>
              <p className='mb-4 text-sm text-muted-foreground'>
                Create your first request to start analyzing scope changes.
              </p>
              <Button asChild>
                <Link href={`/dashboard/new-request?project=${project.id}`}>
                  Create Request
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
