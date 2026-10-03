import { useEffect, useState } from 'react'

// Chrome / Samsung Internet fire `beforeinstallprompt`; iOS Safari needs manual "Add to Home Screen".
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  listeners.forEach((l) => l())
})

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)

export function useInstallPrompt() {
  const [canPrompt, setCanPrompt] = useState(deferred !== null)
  useEffect(() => {
    const l = () => setCanPrompt(deferred !== null)
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    deferred = null
    setCanPrompt(false)
  }
  return { canPrompt, install }
}
