'use client'

import { useEffect, useState } from 'react'

// BeforeInstallPromptEvent n'est pas dans les types standard
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
    navigator.vendor === 'Apple Computer, Inc.' &&
    !ua.includes('CriOS') &&
    !ua.includes('FxiOS') &&
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
    // Ne jamais afficher si contexte Instagram (InstagramBanner prioritaire)
    if (isInstagramContext()) return
    // Déjà installé en standalone
    if ((navigator as Navigator & { standalone?: boolean }).standalone) return
    // Déjà installé via flag
    if (localStorage.getItem(INSTALLED_KEY)) return
    // Dismissed récemment
    if (isDismissedRecently()) return

    // iOS Safari : instructif uniquement
    if (isIosSafari()) {
      setMode('ios')
      setVisible(true)
      try {
        window.va?.('event', { name: 'install_prompt_shown', data: { platform: 'ios' } })
      } catch {}
      return
    }

    // Android Chrome / Samsung Internet : attendre beforeinstallprompt
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
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        background: '#1C1C1C',
        color: '#F5F3EF',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.4', flex: 1 }}>
          {mode === 'android'
            ? 'Installe Waveform sur ton téléphone pour un accès rapide.'
            : "Tape l'icône \u25a1\u2191 puis \"Sur l'écran d'accueil\" pour installer Waveform."}
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

      {mode === 'android' && (
        <button
          onClick={install}
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
          Ajouter à l&apos;écran d&apos;accueil
        </button>
      )}
    </div>
  )
}
