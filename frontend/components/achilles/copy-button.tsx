'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CopyButton({
  text,
  label = 'Copy',
  className,
  variant = 'outline',
}: {
  text: string
  label?: string
  className?: string
  variant?: 'outline' | 'solid'
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-150',
        variant === 'outline' && 'border border-border bg-card text-navy hover:border-aegean/40 hover:bg-surface-soft',
        variant === 'solid' && 'bg-primary text-primary-foreground hover:bg-[#195d87]',
        copied && variant === 'outline' && 'border-success/40 text-success',
        className,
      )}
    >
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  )
}
