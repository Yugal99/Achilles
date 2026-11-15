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
        'inline-flex min-h-12 shrink-0 items-center gap-2 rounded-sm px-4 text-sm transition-[background-color,filter] duration-150',
        variant === 'outline' && 'border border-accent font-semibold text-accent hover:bg-accent/10',
        variant === 'solid' && 'bg-accent font-bold text-primary-foreground hover:brightness-110',
        className,
      )}
    >
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  )
}
