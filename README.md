# A Pranav Koundinya — Portfolio

A dark, animation-heavy personal portfolio. Pure static HTML/CSS/JS with **no build step**, so it can be served directly by GitHub Pages.

- **Hero:** WebGL particle field (Three.js) with ~11k GPU particles that morph between a neural sphere, a neural network, a torus knot, a galaxy and a DNA helix. Particles react to the cursor, and a click forces the next morph.
- **Smooth scroll and scroll choreography:** Lenis + GSAP ScrollTrigger for split-text reveals, a scroll-drawn timeline, a velocity-reactive marquee and counters.
- **Live project visualizations:** each project card has its own Canvas 2D simulation (GNN message passing, Markov transitions, forecast bands, LTV curves, U-Net segmentation scan, Playwright agent, and more).
- **Skill constellation:** a draggable, force-directed skill graph.
- **Extras:** custom magnetic cursor, 3D tilt cards, cursor-reactive dot grid, film grain, aurora gradients and `prefers-reduced-motion` support.

All libraries are vendored in `assets/vendor/`, so the site has no CDN dependency apart from Google Fonts.

## Structure

```
index.html              ← all content (edit text here)
assets/
  css/style.css         ← theme + layout
  js/main.js            ← preloader, scroll, cursor, reveals, filters, terminal
  js/hero.js            ← Three.js particle morph hero
  js/viz.js             ← per-project canvas visualizations
  js/skills.js          ← skill constellation
  vendor/               ← three.js, gsap, ScrollTrigger, lenis
  A_Pranav_Koundinya_Resume.pdf
```

## Editing your introduction

Search `index.html` for `EDIT:`. There are three marked blocks:

1. `EDIT: HERO TAGLINE`: the one-liner under your name.
2. `EDIT: INTRODUCTION`: the large dashed "about" panel.
3. `EDIT: CONTACT BLURB`: the paragraph above the email button.

## Run locally

The JS uses ES modules, so serve the folder over HTTP rather than opening the file directly:

```bash
cd pranav-portfolio
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a repo, for example `A-Pranav-Koundinya.github.io` for a root URL, or any other name for `/<repo>/`.
2. Push this folder's contents to the `main` branch:
   ```bash
   git init && git add . && git commit -m "Portfolio"
   git branch -M main
   git remote add origin https://github.com/A-Pranav-Koundinya/<repo>.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages → Build and deployment**, set **Source: Deploy from a branch**, then choose **Branch: `main` / root** and save.

All asset paths are relative, so the site works at both the root domain and a `/<repo>/` sub-path. The `.nojekyll` file tells Pages to serve the files as-is.
