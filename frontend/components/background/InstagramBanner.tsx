'use client'

import { useEffect, useState } from 'react'

type Platform = 'android' | 'ios' | null

function detectPlatform(ua: string): Platform {
  if (/iPhone|iPad/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return null
}

function buildIntentUrl(): string {
  const { host, pathname, search, hash } = location
  const fullPath = pathname + search + hash
  const fallback = encodeURIComponent(`https://${host}${fullPath}`)
  return `intent://${host}${fullPath}#Intent;scheme=https;S.browser_fallback_url=${fallback};end`
}

export default function InstagramBanner() {
  const [visible, setVisible] = useState(false)
  const [platform, setPlatform] = useState<Platform>(null)
  const [copied, setCopied] = useState(false)
  const [intentFailed, setIntentFailed] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    if (!ua.includes('Instagram')) return
    if (sessionStorage.getItem('ig-banner-dismissed')) return

    setPlatform(detectPlatform(ua))
    setVisible(true)

    try {
      window.va?.('event', { name: 'banner_impression', data: { banner: 'instagram' } })
    } catch {}
  }, [])

  function dismiss() {
    setVisible(false)
    sessionStorage.setItem('ig-banner-dismissed', '1')
    try {
      window.va?.('event', { name: 'banner_close', data: { banner: 'instagram' } })
    } catch {}
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
      try {
        window.va?.('event', { name: 'copy_link_success', data: { banner: 'instagram' } })
      } catch {}
    } catch {
      try {
        window.va?.('event', { name: 'copy_link_fail', data: { banner: 'instagram' } })
      } catch {}
    }
  }

  function openInBrowser() {
    try {
      window.va?.('event', { name: 'open_browser_click', data: { banner: 'instagram' } })
    } catch {}

    location.href = buildIntentUrl()

    setTimeout(() => {
      if (!document.hidden) {
        setIntentFailed(true)
        copyLink()
      }
    }, 1500)
  }

  if (!visible) return null

  return (
    <div
      role="banner"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#1C1C1C',
        color: '#F5F3EF',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      {/* Texte principal */}
      <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.3', flex: 1 }}>
        {platform === 'ios' && (
          <>
            Tape <strong>•••</strong> en haut à droite, puis{' '}
            <strong>Ouvrir dans un navigateur externe</strong>.
          </>
        )}
        {platform === 'android' && (
          intentFailed
            ? (copied ? 'Lien copié — colle-le dans ton navigateur.' : 'Ouvre ton navigateur et colle le lien.')
            : 'Ouvre Waveform dans ton navigateur pour une meilleure expérience.'
        )}
        {platform === null && 'Ouvre ce lien dans ton navigateur.'}
      </p>

      {/* Boutons selon plateforme */}
      {platform === 'android' && !intentFailed && (
        <button
          onClick={openInBrowser}
          style={{
            background: '#F5F3EF',
            color: '#1C1C1C',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Ouvrir
        </button>
      )}
      {(platform === 'ios' || intentFailed) && (
        <button
          onClick={copyLink}
          style={{
            background: 'none',
            border: '1px solid rgba(245,243,239,0.4)',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            color: '#F5F3EF',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {copied ? 'Copié ✓' : 'Copier'}
        </button>
      )}

      {/* Fermer */}
      <button
        onClick={dismiss}
        aria-label="Fermer"
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(245,243,239,0.6)',
          cursor: 'pointer',
          fontSize: '16px',
          padding: '0',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}
