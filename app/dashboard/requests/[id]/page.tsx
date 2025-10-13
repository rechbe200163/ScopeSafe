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
import { ArrowLeft, Sparkles, FileText } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch the request
  const { data: request, error } = await supabase
    .from('requests')
    .select('*, projects(name, client_name, hourly_rate)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !request) {
    notFound();
  }

  // Check if there's a change order for this request
  const { data: changeOrder } = await supabase
    .from('change_orders')
    .select('id')
    .eq('request_id', request.id)
    .single();

  return (
    <div className='container mx-auto max-w-4xl space-y-6 p-6'>
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/dashboard/history'>
            <ArrowLeft className='h-4 w-4' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Request Details</h1>
          <p className='text-muted-foreground'>Review the client request</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className='flex items-start justify-between'>
            <div>
              <CardTitle>{request.projects?.name || 'No Project'}</CardTitle>
              <CardDescription>
                {request.projects?.client_name &&
                  `Client: ${request.projects.client_name} • `}
                Submitted on {new Date(request.created_at).toLocaleDateString()}
              </CardDescription>
            </div>
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
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div>
            <h3 className='mb-2 font-semibold'>Client Message</h3>
            <p className='whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm'>
              {request.client_message}
            </p>
          </div>

          {request.context && (
            <div>
              <h3 className='mb-2 font-semibold'>Additional Context</h3>
              <p className='whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm'>
                {request.context}
              </p>
            </div>
          )}

          <div className='flex gap-3'>
            {request.status === 'pending' ? (
              <Button asChild>
                <Link href={`/dashboard/requests/${request.id}/analyze`}>
                  <Sparkles className='mr-2 h-4 w-4' />
                  Analyze Request
                </Link>
              </Button>
            ) : changeOrder ? (
              <Button asChild>
                <Link href={`/dashboard/change-orders/${changeOrder.id}`}>
                  <FileText className='mr-2 h-4 w-4' />
                  View Change Order
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href={`/dashboard/requests/${request.id}/analyze`}>
                  <Sparkles className='mr-2 h-4 w-4' />
                  Re-analyze Request
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
