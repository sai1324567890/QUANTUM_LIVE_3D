import { useEffect } from 'react'
import scripts from '../legacy/scripts.js'

let started = false

// Runs the site's simulation scripts once, after React has put the markup in the page.
export default function useLegacyScripts() {
  useEffect(() => {
    if (started) return
    started = true
    scripts.forEach((code) => {
      const el = document.createElement('script')
      el.text = code
      document.body.appendChild(el)
    })
  }, [])
}
