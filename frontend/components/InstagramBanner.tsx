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

    // Analytics
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

    const intentUrl = buildIntentUrl()
    location.href = intentUrl

    // Timeout fallback : si la page est encore visible après 1.5s,
    // Instagram a bloqué l'intent → afficher le fallback copie
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
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.4', flex: 1 }}>
          Pour une meilleure expérience, ouvre Waveform dans ton navigateur.
        </p>
        <button
          onClick={dismiss}
          aria-label="Fermer"
          style={{
            background: 'none',
            border: 'none',
            color: '#F5F3EF',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '0 0 0 8px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {platform === 'android' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!intentFailed ? (
            <button
              onClick={openInBrowser}
              style={{
                background: '#F5F3EF',
                color: '#1C1C1C',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Ouvrir dans le navigateur
            </button>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: '#ccc' }}>
              {copied
                ? 'Lien copié. Colle-le dans ton navigateur.'
                : 'Copie le lien et colle-le dans ton navigateur.'}
            </p>
          )}
          <button
            onClick={copyLink}
            style={{
              background: 'none',
              border: '1px solid rgba(245,243,239,0.3)',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              color: '#F5F3EF',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {copied ? 'Lien copié ✓' : 'Copier le lien'}
          </button>
        </div>
      )}

      {platform === 'ios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#ccc' }}>
            Tape <strong>•••</strong> en bas à droite, puis <strong>Ouvrir dans Safari</strong>.
          </p>
          <button
            onClick={copyLink}
            style={{
              background: 'none',
              border: '1px solid rgba(245,243,239,0.3)',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              color: '#F5F3EF',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {copied ? 'Lien copié ✓' : 'Copier le lien'}
          </button>
        </div>
      )}
    </div>
  )
}
