import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
// The client you created from the Server-Side Auth instructions

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get('next') ?? '/';
  if (!next.startsWith('/')) {
    // if "next" is not a relative URL, use the default
    next = '/';
  }

  if (code) {
    const supabase = await createClient();
    const {
      data: { user: exchangedUser },
      error: exchangeError,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      const activeUser = user ?? exchangedUser;

      const email = activeUser?.email ?? activeUser?.user_metadata?.email;

      if (activeUser && email) {
        const preferredName =
          activeUser.user_metadata?.name ??
          activeUser.user_metadata?.full_name ??
          activeUser.user_metadata?.user_name ??
          null;

        const { error: upsertError } = await supabase.from('users').upsert(
          {
            id: activeUser.id,
            email,
            name: preferredName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        if (upsertError) {
          console.error('Failed to upsert user profile', upsertError);
        }
      } else if (userError) {
        console.error(
          'Failed to load user after exchanging auth code',
          userError
        );
      }

      const forwardedHost = request.headers.get('x-forwarded-host'); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
