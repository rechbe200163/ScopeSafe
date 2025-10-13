'use client';

import type React from 'react';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Project {
  id: string;
  name: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  description: string | null;
  status: string;
  budget: number | null;
  hourly_rate: number | null;
}

export function ProjectEditForm({ project }: { project: Project }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: project.name,
    client_name: project.client_name,
    client_email: project.client_email || '',
    client_phone: project.client_phone || '',
    description: project.description || '',
    status: project.status,
    budget: project.budget?.toString() || '',
    hourly_rate: project.hourly_rate?.toString() || '',
  });
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: formData.name,
          client_name: formData.client_name,
          client_email: formData.client_email || null,
          client_phone: formData.client_phone || null,
          description: formData.description || null,
          status: formData.status,
          budget: formData.budget ? Number.parseFloat(formData.budget) : null,
          hourly_rate: formData.hourly_rate
            ? Number.parseFloat(formData.hourly_rate)
            : null,
        })
        .eq('id', project.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Project updated successfully',
      });

      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: 'Error',
        description: 'Failed to update project',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: project.name,
      client_name: project.client_name,
      client_email: project.client_email || '',
      client_phone: project.client_phone || '',
      description: project.description || '',
      status: project.status,
      budget: project.budget?.toString() || '',
      hourly_rate: project.hourly_rate?.toString() || '',
    });
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>Project Information</CardTitle>
          {!isEditing ? (
            <Button
              variant='outline'
              size='sm'
              onClick={() => setIsEditing(true)}
            >
              <Pencil className='mr-2 h-4 w-4' />
              Edit
            </Button>
          ) : (
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={handleCancel}
                disabled={isLoading}
              >
                <X className='mr-2 h-4 w-4' />
                Cancel
              </Button>
              <Button size='sm' onClick={handleSubmit} disabled={isLoading}>
                <Save className='mr-2 h-4 w-4' />
                {isLoading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='name'>Project Name</Label>
                <Input
                  id='name'
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='client_name'>Client Name</Label>
                <Input
                  id='client_name'
                  value={formData.client_name}
                  onChange={(e) =>
                    setFormData({ ...formData, client_name: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='client_email'>Client Email</Label>
                <Input
                  id='client_email'
                  type='email'
                  value={formData.client_email}
                  onChange={(e) =>
                    setFormData({ ...formData, client_email: e.target.value })
                  }
                  placeholder='client@example.com'
                />
                <p className='text-sm text-muted-foreground'>
                  We use this email later to send automated change orders to the
                  client.
                </p>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='client_phone'>Client Phone Number</Label>
                <Input
                  id='client_phone'
                  type='tel'
                  value={formData.client_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, client_phone: e.target.value })
                  }
                  placeholder='+1 (555) 123-4567'
                />
                <p className='text-sm text-muted-foreground'>
                  This contact number supports automated change order
                  notifications.
                </p>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='description'>Description</Label>
              <Textarea
                id='description'
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className='grid gap-4 sm:grid-cols-3'>
              <div className='space-y-2'>
                <Label htmlFor='status'>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger id='status'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='active'>Active</SelectItem>
                    <SelectItem value='on_hold'>On Hold</SelectItem>
                    <SelectItem value='completed'>Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='budget'>Budget ($)</Label>
                <Input
                  id='budget'
                  type='number'
                  step='0.01'
                  value={formData.budget}
                  onChange={(e) =>
                    setFormData({ ...formData, budget: e.target.value })
                  }
                  placeholder='0.00'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='hourly_rate'>Hourly Rate ($)</Label>
                <Input
                  id='hourly_rate'
                  type='number'
                  step='0.01'
                  value={formData.hourly_rate}
                  onChange={(e) =>
                    setFormData({ ...formData, hourly_rate: e.target.value })
                  }
                  placeholder='0.00'
                />
              </div>
            </div>
          </form>
        ) : (
          <div className='space-y-6'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-1'>
                <h3 className='text-sm font-medium text-muted-foreground'>
                  Project Name
                </h3>
                <p className='text-sm text-muted-foreground'>{project.name}</p>
              </div>
              <div className='space-y-1'>
                <h3 className='text-sm font-medium text-muted-foreground'>
                  Client Name
                </h3>
                <p className='text-sm text-muted-foreground'>
                  {project.client_name}
                </p>
              </div>
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-1'>
                <h3 className='text-sm font-medium text-muted-foreground'>
                  Client Email
                </h3>
                <p className='text-sm text-muted-foreground'>
                  {project.client_email ?? 'Not set'}
                </p>
              </div>
              <div className='space-y-1'>
                <h3 className='text-sm font-medium text-muted-foreground'>
                  Client Phone Number
                </h3>
                <p className='text-sm text-muted-foreground'>
                  {project.client_phone ?? 'Not set'}
                </p>
              </div>
            </div>

            <div className='space-y-1'>
              <h3 className='text-sm font-medium text-muted-foreground'>
                Description
              </h3>
              <p className='text-sm text-muted-foreground'>
                {project.description || 'No description provided.'}
              </p>
            </div>

            <div className='grid gap-4 sm:grid-cols-3'>
              <div className='space-y-1'>
                <h3 className='text-sm font-medium text-muted-foreground'>
                  Status
                </h3>
                <p className='text-sm text-muted-foreground'>
                  {project.status}
                </p>
              </div>
              <div className='space-y-1'>
                <h3 className='text-sm font-medium text-muted-foreground'>
                  Budget
                </h3>
                <p className='text-sm text-muted-foreground'>
                  {typeof project.budget === 'number'
                    ? `$${project.budget.toFixed(2)}`
                    : 'Not set'}
                </p>
              </div>
              <div className='space-y-1'>
                <h3 className='text-sm font-medium text-muted-foreground'>
                  Hourly Rate
                </h3>
                <p className='text-sm text-muted-foreground'>
                  {typeof project.hourly_rate === 'number'
                    ? `$${project.hourly_rate.toFixed(2)}/hr`
                    : 'Not set'}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
