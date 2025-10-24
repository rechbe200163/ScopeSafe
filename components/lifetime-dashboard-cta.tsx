'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

interface LifetimeDashboardCtaProps {
  initialIsLifetimeUser: boolean
  userName?: string | null
  userEmail?: string | null
  avatarUrl?: string | null
}

type StoredLifetimeUser = {
  isLifetimeUser: boolean
  userName: string | null
  userEmail: string | null
  avatarUrl: string | null
  updatedAt?: string | null
}

const STORAGE_KEY = 'scopesafe:lifetime-user'

function parseStoredLifetimeUser(rawValue: string | null): StoredLifetimeUser | null {
  if (!rawValue) return null
  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredLifetimeUser>
    if (!parsed || typeof parsed !== 'object') return null

    return {
      isLifetimeUser: Boolean(parsed.isLifetimeUser),
      userName: typeof parsed.userName === 'string' ? parsed.userName : null,
      userEmail: typeof parsed.userEmail === 'string' ? parsed.userEmail : null,
      avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : null,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    }
  } catch (error) {
    console.warn('Failed to parse stored lifetime user state:', error)
    return null
  }
}

export function LifetimeDashboardCta({
  initialIsLifetimeUser,
  userName = null,
  userEmail = null,
  avatarUrl = null,
}: LifetimeDashboardCtaProps) {
  const [state, setState] = useState<StoredLifetimeUser>(() => ({
    isLifetimeUser: initialIsLifetimeUser,
    userName: initialIsLifetimeUser ? userName : null,
    userEmail: initialIsLifetimeUser ? userEmail : null,
    avatarUrl: initialIsLifetimeUser ? avatarUrl : null,
    updatedAt: null,
  }))

  useEffect(() => {
    if (typeof window === 'undefined') return

    const stored = parseStoredLifetimeUser(window.localStorage.getItem(STORAGE_KEY))

    if (stored?.isLifetimeUser) {
      setState((previous) => ({
        isLifetimeUser: true,
        userName: stored.userName ?? previous.userName,
        userEmail: stored.userEmail ?? previous.userEmail,
        avatarUrl: stored.avatarUrl ?? previous.avatarUrl,
        updatedAt: stored.updatedAt ?? previous.updatedAt ?? null,
      }))
    }
  }, [])

  useEffect(() => {
    if (!initialIsLifetimeUser) return

    setState((previous) => {
      const nextState: StoredLifetimeUser = {
        isLifetimeUser: true,
        userName: userName ?? previous.userName,
        userEmail: userEmail ?? previous.userEmail,
        avatarUrl: avatarUrl ?? previous.avatarUrl,
        updatedAt: new Date().toISOString(),
      }

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
        } catch (error) {
          console.warn('Failed to persist lifetime user state:', error)
        }
      }

      return nextState
    })
  }, [initialIsLifetimeUser, userName, userEmail, avatarUrl])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return

      const updated = parseStoredLifetimeUser(event.newValue)
      if (updated?.isLifetimeUser) {
        setState((previous) => ({
          isLifetimeUser: true,
          userName: updated.userName ?? previous.userName,
          userEmail: updated.userEmail ?? previous.userEmail,
          avatarUrl: updated.avatarUrl ?? previous.avatarUrl,
          updatedAt: updated.updatedAt ?? previous.updatedAt ?? null,
        }))
      } else {
        setState({
          isLifetimeUser: false,
          userName: null,
          userEmail: null,
          avatarUrl: null,
          updatedAt: null,
        })
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const displayName = useMemo(() => {
    if (state.userName && state.userName.trim().length > 0) {
      return state.userName.trim()
    }
    if (state.userEmail && state.userEmail.trim().length > 0) {
      return state.userEmail.trim()
    }
    return 'Lifetime member'
  }, [state.userName, state.userEmail])

  const avatarInitials = useMemo(() => {
    const source = state.userName?.trim() || state.userEmail?.trim() || ''
    if (!source) return 'LM'

    const parts = source.split(/\s+/).filter(Boolean)
    if (parts.length === 0 && state.userEmail) {
      return state.userEmail.slice(0, 2).toUpperCase()
    }

    const letters = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase())
    if (!letters.length && state.userEmail) {
      return state.userEmail.slice(0, 2).toUpperCase()
    }

    return letters.join('') || 'LM'
  }, [state.userName, state.userEmail])

  if (!state.isLifetimeUser) {
    return null
  }

  return (
    <div className='sticky top-0 z-30 flex w-full justify-center border-b border-border bg-background/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur'>
      <div className='flex w-full max-w-6xl items-center justify-end'>
        <Button
          asChild
          variant='outline'
          size='sm'
          className='gap-2 rounded-full pl-2 pr-3 shadow-sm transition-colors hover:bg-accent'
        >
          <Link href='/dashboard'>
            <Avatar className='size-8 bg-muted'>
              {state.avatarUrl ? (
                <AvatarImage src={state.avatarUrl} alt={displayName} />
              ) : (
                <AvatarFallback>{avatarInitials}</AvatarFallback>
              )}
            </Avatar>
            <span className='text-sm font-semibold'>Dashboard</span>
            <LayoutDashboard className='size-4' />
          </Link>
        </Button>
      </div>
    </div>
  )
}
