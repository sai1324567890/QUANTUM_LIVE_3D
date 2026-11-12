import body from '../legacy/body.html?raw'
import useLegacyScripts from '../hooks/useLegacyScripts.js'

// The full Quantum Hub page (nav, AI simulator, Parts I-III, knowledge base, plans).
export default function SiteShell() {
  useLegacyScripts()
  return <div id="top" dangerouslySetInnerHTML={{ __html: body }} />
}
