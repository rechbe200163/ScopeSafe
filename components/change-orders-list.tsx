'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import Link from 'next/link';
import {
  FileText,
  DollarSign,
  Clock,
  Trash2,
  Download,
  Send,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type ChangeOrder = {
  id: string;
  title: string;
  description: string | null;
  estimated_hours: number;
  estimated_cost: number;
  status: string;
  created_at: string;
  request_id: string;
  requests: {
    client_message: string;
    created_at: string;
  } | null;
};

export function ChangeOrdersList({
  changeOrders,
  sendEmailAvailable = false,
}: {
  changeOrders: ChangeOrder[];
  sendEmailAvailable?: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/change-orders/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete change order');
      }

      toast.success('Change order deleted successfully');
      router.refresh();
    } catch (error) {
      console.error('Error deleting change order:', error);
      toast.error('Failed to delete change order');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadPDF = async (id: string) => {
    try {
      const response = await fetch(`/api/generate-pdf/${id}`);
      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `change-order-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  const handleSendEmail = async (id: string) => {
    setSendingId(id);
    try {
      const response = await fetch(`/api/change-orders/${id}/send`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to send change order email');
      }

      toast.success('Change order email sent to the client');
      router.refresh();
    } catch (error) {
      console.error('Error sending change order email:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to send change order email'
      );
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className='space-y-4'>
      <h2 className='text-2xl font-bold'>Change Orders</h2>

      {changeOrders.length > 0 ? (
        <div className='space-y-4'>
          {changeOrders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className='flex items-start justify-between'>
                  <div className='flex-1'>
                    <CardTitle className='text-lg'>{order.title}</CardTitle>
                    <CardDescription className='mt-1'>
                      Created {new Date(order.created_at).toLocaleDateString()}
                    </CardDescription>
                    {order.description && (
                      <p className='mt-2 line-clamp-2 text-sm text-muted-foreground'>
                        {order.description}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={order.status === 'draft' ? 'outline' : 'default'}
                  >
                    {order.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className='flex items-center justify-between'>
                  <div className='flex gap-4 text-sm text-muted-foreground'>
                    <span className='flex items-center gap-1'>
                      <Clock className='h-4 w-4' />
                      {order.estimated_hours}h
                    </span>
                    <span className='flex items-center gap-1'>
                      <DollarSign className='h-4 w-4' />$
                      {order.estimated_cost.toFixed(2)}
                    </span>
                  </div>
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      onClick={() => handleSendEmail(order.id)}
                      disabled={
                        sendingId === order.id ||
                        !sendEmailAvailable ||
                        order.status !== 'draft'
                      }
                    >
                      {sendingId === order.id ? (
                        <>
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                          Sending
                        </>
                      ) : sendEmailAvailable ? (
                        <>
                          <Send className='mr-2 h-4 w-4' />
                          Email
                        </>
                      ) : (
                        <>Upgrade to Pro to send emails</>
                      )}
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => handleDownloadPDF(order.id)}
                    >
                      <Download className='mr-2 h-4 w-4' />
                      PDF
                    </Button>
                    <Button variant='outline' size='sm' asChild>
                      <Link href={`/dashboard/change-orders/${order.id}`}>
                        View/Edit
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant='outline'
                          size='sm'
                          disabled={deletingId === order.id}
                        >
                          <Trash2 className='h-4 w-4 text-destructive' />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete Change Order?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this change order. This
                            action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(order.id)}
                            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <FileText className='mb-4 h-12 w-12 text-muted-foreground' />
            <p className='mb-2 text-lg font-medium'>No change orders yet</p>
            <p className='text-sm text-muted-foreground'>
              Change orders will appear here once you analyze and create them
              from requests.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
