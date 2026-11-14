'use client'

import { useState } from 'react'
import { ArrowRight, Check, FileCode2, Loader2, Network, ShieldCheck } from 'lucide-react'
import { CopyButton } from './copy-button'
import { cn } from '@/lib/utils'

type Method = 'dns' | 'meta'

const TOKEN = 'achilles-verify=7f3a9c2e41b8'

export function VerifyStep({ host, onVerified }: { host: string; onVerified: () => void }) {
  const [method, setMethod] = useState<Method>('dns')
  const [authorized, setAuthorized] = useState(false)
  const [status, setStatus] = useState<'idle' | 'checking' | 'verified'>('idle')

  const snippet =
    method === 'dns' ? TOKEN : `<meta name="achilles-site-verification" content="7f3a9c2e41b8" />`

  function verify() {
    setStatus('checking')
    setTimeout(() => setStatus('verified'), 1800)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center">
        <ShieldCheck className="mx-auto size-8 text-gold" aria-hidden="true" />
        <h1 className="mt-4 font-serif text-3xl font-semibold text-balance">Prove this kingdom is yours</h1>
        <p className="mt-3 text-muted-foreground">
          To keep scanning safe and legal, confirm you own{' '}
          <span className="font-medium text-foreground">{host}</span>.
        </p>
      </div>

      <div className="mt-10 rounded-lg border border-border bg-card p-6 sm:p-8">
        <div role="radiogroup" aria-label="Verification method" className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { id: 'dns', icon: Network, title: 'DNS TXT record', body: 'Best for custom domains' },
              { id: 'meta', icon: FileCode2, title: 'HTML meta tag', body: 'Easiest for vibe-coded apps' },
            ] as const
          ).map(({ id, icon: Icon, title, body }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={method === id}
              onClick={() => setMethod(id)}
              disabled={status !== 'idle'}
              className={cn(
                'flex items-start gap-3 rounded-md border p-4 text-left transition-colors disabled:opacity-60',
                method === id ? 'border-gold bg-gold-soft' : 'border-border hover:border-gold/40',
              )}
            >
              <Icon className={cn('mt-0.5 size-5', method === id ? 'text-gold' : 'text-muted-foreground')} aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-muted-foreground">{body}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <p className="text-sm text-muted-foreground">
            {method === 'dns' ? (
              <>
                Add a <span className="text-foreground">TXT</span> record to <span className="text-foreground">{host}</span> with this value:
              </>
            ) : (
              <>
                Paste this inside the <span className="font-mono text-foreground">{'<head>'}</span> of your homepage:
              </>
            )}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3">
            <code className="overflow-x-auto whitespace-nowrap font-mono text-sm text-gold">{snippet}</code>
            <CopyButton text={snippet} />
          </div>
          {method === 'meta' && (
            <p className="mt-2 text-xs text-muted-foreground">
              Tip: ask your AI builder “Add this meta tag to my root layout head.”
            </p>
          )}
        </div>

        <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
            disabled={status !== 'idle'}
            className="mt-0.5 size-4 accent-[var(--gold)]"
          />
          I own this app or have written permission to test it.
        </label>

        <div className="mt-8">
          {status === 'verified' ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              <p role="status" className="flex items-center gap-2 text-sm text-foreground">
                <span className="flex size-6 items-center justify-center rounded-full bg-gold text-primary-foreground">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                Ownership verified for {host}
              </p>
              <button
                type="button"
                onClick={onVerified}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gold px-6 text-sm font-semibold text-primary-foreground hover:brightness-110 sm:w-auto"
              >
                Begin scan <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={verify}
              disabled={!authorized || status === 'checking'}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gold px-6 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === 'checking' ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking {method === 'dns' ? 'DNS' : 'homepage'}…
                </>
              ) : (
                'Verify ownership'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
