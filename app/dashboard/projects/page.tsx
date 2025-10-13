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
import { Plus, FolderOpen } from 'lucide-react';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className='container mx-auto max-w-7xl p-6'>
        <p className='text-center text-red-500'>Unauthorized</p>
      </div>
    );
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className='container mx-auto max-w-7xl space-y-8 p-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Projects</h1>
          <p className='text-muted-foreground'>Manage your client projects</p>
        </div>
        <Button asChild size='lg'>
          <Link href='/dashboard/projects/new'>
            <Plus className='mr-2 h-5 w-5' />
            New Project
          </Link>
        </Button>
      </div>

      {projects && projects.length > 0 ? (
        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
          {projects.map((project) => (
            <Card
              key={project.id}
              className='hover:shadow-md transition-shadow'
            >
              <CardHeader>
                <div className='flex items-start justify-between'>
                  <FolderOpen className='h-8 w-8 text-primary' />
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      project.status === 'active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : project.status === 'completed'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                    }`}
                  >
                    {project.status}
                  </span>
                </div>
                <CardTitle className='mt-4'>{project.name}</CardTitle>
                <CardDescription>Client: {project.client_name}</CardDescription>
              </CardHeader>
              <CardContent>
                {project.description && (
                  <p className='mb-4 text-sm text-muted-foreground line-clamp-2'>
                    {project.description}
                  </p>
                )}
                <Button
                  variant='outline'
                  size='sm'
                  asChild
                  className='w-full bg-transparent'
                >
                  <Link href={`/dashboard/projects/${project.id}`}>
                    View Details
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <FolderOpen className='mb-4 h-12 w-12 text-muted-foreground' />
            <p className='mb-2 text-lg font-medium'>No projects yet</p>
            <p className='mb-4 text-sm text-muted-foreground'>
              Create your first project to start managing change orders.
            </p>
            <Button asChild>
              <Link href='/dashboard/projects/new'>Create Project</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
