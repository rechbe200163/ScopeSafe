'use client';

import type React from 'react';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Github } from 'lucide-react';
import { getBaseUrl } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirectParam =
    searchParams.get('redirectTo') ?? searchParams.get('next');
  const redirectTo =
    redirectParam &&
    redirectParam.startsWith('/') &&
    !redirectParam.startsWith('//')
      ? redirectParam
      : '/dashboard';
  const authErrorParam = searchParams.get('authError');

  useEffect(() => {
    if (authErrorParam) {
      setError(authErrorParam);
    }
  }, [authErrorParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsPasswordLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push(redirectTo);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    const supabase = createClient();
    setIsGithubLoading(true);
    setError(null);

    try {
      const origin = getBaseUrl();
      console.log('Origin for GitHub OAuth redirect:', origin);
      const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(
        redirectTo
      )}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: callbackUrl,
        },
      });
      if (error) {
        setIsGithubLoading(false);
        throw error;
      }
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : 'Unable to sign in with GitHub'
      );
      setIsGithubLoading(false);
    }
  };

  return (
    <div className='flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-background to-muted p-6'>
      <div className='w-full max-w-md'>
        <div className='mb-8 text-center'>
          <h1 className='text-4xl font-bold tracking-tight'>ScopeSafe</h1>
          <p className='mt-2 text-muted-foreground'>
            AI-Powered Change Order Assistant
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className='text-2xl'>Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin}>
              <div className='flex flex-col gap-6'>
                <div className='grid gap-2'>
                  <Label htmlFor='email'>Email</Label>
                  <Input
                    id='email'
                    type='email'
                    placeholder='you@example.com'
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='password'>Password</Label>
                  <Input
                    id='password'
                    type='password'
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <div className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'>
                    {error}
                  </div>
                )}
                <Button
                  type='submit'
                  className='w-full'
                  disabled={isPasswordLoading || isGithubLoading}
                >
                  {isPasswordLoading ? 'Signing in...' : 'Sign in'}
                </Button>
              </div>
              <div className='mt-4 text-center text-sm'>
                Don&apos;t have an account?{' '}
                <Link
                  href='/auth/sign-up'
                  className='font-medium underline underline-offset-4'
                >
                  Sign up
                </Link>
              </div>
            </form>
            <div className='mt-6'>
              <div className='flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground'>
                <Separator className='flex-1' />
                <span>Or continue with</span>
                <Separator className='flex-1' />
              </div>
              <Button
                type='button'
                variant='outline'
                className='mt-4 w-full'
                onClick={handleGithubLogin}
                disabled={isGithubLoading || isPasswordLoading}
              >
                <Github className='mr-2 h-4 w-4' />
                {isGithubLoading ? 'Connecting...' : 'Continue with GitHub'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
