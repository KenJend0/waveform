'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'pwa-dismissed'
const INSTALLED_KEY = 'pwa-installed'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours

function isIosSafari(): boolean {
  const ua = navigator.userAgent
  return (
    /iPhone|iPad/.test(ua) &&
    !ua.includes('CriOS') &&
    !ua.includes('FxiOS') &&
    !ua.includes('Instagram') &&
    !(navigator as Navigator & { standalone?: boolean }).standalone
  )
}

function isInstagramContext(): boolean {
  return navigator.userAgent.includes('Instagram')
}

function isDismissedRecently(): boolean {
  const ts = localStorage.getItem(DISMISSED_KEY)
  if (!ts) return false
  return Date.now() - Number(ts) < DISMISS_COOLDOWN_MS
}

export default function InstallBanner() {
  const [mode, setMode] = useState<'android' | 'ios' | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)

    if (params.has('reset-install')) {
      localStorage.removeItem(DISMISSED_KEY)
      localStorage.removeItem(INSTALLED_KEY)
      params.delete('reset-install')
      const clean = [location.pathname, params.toString()].filter(Boolean).join('?')
      location.replace(clean)
      return
    }

    if (isInstagramContext()) return
    if ((navigator as Navigator & { standalone?: boolean }).standalone) return
    if (localStorage.getItem(INSTALLED_KEY)) return
    if (isDismissedRecently()) return

    if (isIosSafari()) {
      setMode('ios')
      setVisible(true)
      try {
        window.va?.('event', { name: 'install_prompt_shown', data: { platform: 'ios' } })
      } catch {}
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setMode('android')
      setVisible(true)
      try {
        window.va?.('event', { name: 'install_prompt_shown', data: { platform: 'android' } })
      } catch {}
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    try {
      window.va?.('event', { name: 'install_dismiss' })
    } catch {}
  }

  async function install() {
    if (!deferredPrompt) return
    const result = await deferredPrompt.prompt()
    if (result.outcome === 'accepted') {
      localStorage.setItem(INSTALLED_KEY, '1')
      try {
        window.va?.('event', { name: 'install_accept' })
      } catch {}
    } else {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
      try {
        window.va?.('event', { name: 'install_dismiss' })
      } catch {}
    }
    setVisible(false)
    setDeferredPrompt(null)
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
        zIndex: 9998,
        background: '#1C1C1C',
        color: '#F5F3EF',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.3', flex: 1 }}>
        {mode === 'ios'
          ? <>Tape <strong>•••</strong> en bas à droite, puis <strong>Partager</strong>, puis <strong>Sur l&apos;écran d&apos;accueil</strong>.</>
          : <>Installe Waveform — accès rapide depuis ton écran d&apos;accueil.</>
        }
      </p>

      {mode === 'android' && (
        <button
          onClick={install}
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
          Installer
        </button>
      )}

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
