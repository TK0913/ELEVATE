# ELEVATE

Marketing site for Elevate, an architecture and interior design studio in Dubai.
Plain static HTML, CSS and JavaScript (GSAP, ScrollTrigger and Lenis are loaded from CDNs) — no build step.

## Run locally

    python -m http.server 8420

Then open http://localhost:8420

## Deploy (Netlify)

Import the repo in Netlify. `netlify.toml` already sets the publish directory to the repo root and no build command is needed.

The contact form is front-end only (it shows a confirmation but sends nothing). Connect a form backend, such as Netlify Forms, before going live.
