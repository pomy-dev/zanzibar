'use client'

import { Copy, Mail, MessageCircle, Share2, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type DocumentShareMenuProps = {
  title: string
  details: string
  url?: string
}

export function DocumentShareMenu({ title, details, url }: DocumentShareMenuProps) {
  const shareUrl = url && /^https?:\/\//i.test(url) ? url : undefined
  const shareText = `${details}${shareUrl ? `\n${shareUrl}` : ''}`

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      toast.success('Document details copied to clipboard.')
    } catch {
      window.prompt('Copy these document details to share:', shareText)
    }
  }

  const shareWithDevice = async () => {
    if (!navigator.share) {
      await copyToClipboard()
      return
    }

    try {
      await navigator.share({ title, text: details, ...(shareUrl ? { url: shareUrl } : {}) })
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        toast.error('Unable to open the share menu.')
      }
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <Share2 className="mr-1 h-3.5 w-3.5" />
        Share
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer')}>
          <MessageCircle /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.location.assign(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareText)}`)}>
          <Mail /> Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.location.assign(`sms:?body=${encodeURIComponent(shareText)}`)}>
          <Smartphone /> SMS
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void copyToClipboard()}>
          <Copy /> Copy to clipboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void shareWithDevice()}>
          <Share2 /> More sharing options
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
