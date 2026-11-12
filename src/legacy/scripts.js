// Scripts run in this exact order, after the page markup is in the DOM.
import ai from './js/00-ai-simulator-auth.js?raw'        // AI question box, 8 simulations, Google/local accounts, ads
import studio from './js/01-simulation-studio.js?raw'    // Part III: course catalogue, 3D Qiskit stack, 5 extra simulations
import knowledge from './js/02-knowledge-pricing.js?raw' // knowledge base buttons + waitlist form
import hub from './js/03-hub-lessons.js?raw'             // Part I: Hub hero + 12 concept lessons
import course from './js/04-course-modules.js?raw'       // Part II: 26 modules, Quantum Lab, quiz, 3D scenes
import theme from './js/05-theme-toggle.js?raw'          // light / dark theme toggle

export default [ai, studio, knowledge, hub, course, theme]
