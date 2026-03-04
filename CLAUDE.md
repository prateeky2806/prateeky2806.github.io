# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website for Prateek Yadav, a Senior Research Scientist at Google DeepMind working on Gemini, pre-training, RL, modular models, and model merging. Zero-dependency vanilla HTML/CSS/JS static site deployed to GitHub Pages at `prateeky2806.github.io`. Visitors are randomly shown one of two design variants (space or terminal).

## Development

**No build step.** Open `index.html` directly in a browser or use any local server:
```bash
python3 -m http.server 8000
# or
npx serve .
```

**Deployment:** Push `main` to GitHub Pages. The `.nojekyll` file disables Jekyll processing. No CI/CD or build tools required. GitHub auto-deploys when main is updated.

**To test fetch-based data loading locally**, you need a local server (the JSON fetch won't work via `file://` protocol due to CORS).

## Git Workflow & Checkpointing

### Commit messages

**Never include "Claude", "Co-Authored-By", or any AI attribution in commit messages.** Commit messages should read as if written by the developer — no AI credits, signatures, or co-author tags.

### Commit frequently, clean up at the end

When working on a feature or building a branch, **commit after every meaningful change** (file created, section completed, bug fixed) to avoid losing work. Use descriptive messages prefixed with `wip:`:

```bash
git add css/style.css && git commit -m "wip: base CSS variables and reset"
git add index.html && git commit -m "wip: hero section HTML"
git add js/app.js && git commit -m "wip: publication rendering and filtering"
```

**Before the final commit**, collapse all intermediate commits into one clean commit using soft reset:

```bash
git reset --soft main
git commit -m "Build retro-terminal website"
```

This preserves a clean commit history (one commit per feature) while giving you safety checkpoints during development. Never leave `wip:` commits in the final history.

### Resuming failed or interrupted tasks

If a task was interrupted (rate limit, crash, etc.), check what progress was made before starting over:

```bash
# 1. Check which branch was being worked on
git branch

# 2. See what commits exist since branching from main
git log --oneline main..HEAD

# 3. See what files were created/modified
git diff --name-status main..HEAD

# 4. Check for any uncommitted work in progress
git status
git diff
```

Resume from the last checkpoint — read the existing files to understand what's already built, then continue from where it left off. Do NOT start from scratch if partial work exists.

## Branch Strategy

### Deployment flow

```
deploy (staging) → main (live site) → GitHub Pages
```

- **main** — Live production site served by GitHub Pages. **NEVER commit directly to main.** Only update via merge from deploy.
- **deploy** — Staging branch. **ALL changes go here first.** Test locally, then merge to main only when the user explicitly asks.

Workflow:
```bash
# 1. Always work on deploy branch
git checkout deploy

# 2. Make changes, commit

# 3. Test locally
python3 -m http.server 8000

# 4. ONLY when user asks to deploy/push to production:
git checkout main
git merge deploy
git push origin main

# 5. GitHub Pages auto-deploys from main
```

**Important:** Do NOT merge deploy into main or push to main unless the user explicitly requests it. The user will decide when changes are ready to go live.

### Site structure (on main/deploy)

The root `index.html` randomly redirects visitors to one of two designs:

```
/index.html              ← randomizer (sessionStorage + location.replace)
/data/                   ← shared content.json, publications.json, news.json
/assets/                 ← shared images, PDFs
/space/                  ← constellation/space design
/terminal/               ← retro-terminal hacker design
```

Both designs fetch shared data from `../data/` (relative to their subdirectory).

### Shared content

All designs load content dynamically from `data/content.json` via their JS `loadContent()` function. To update bio, career, socials, or interests, edit `data/content.json` — it propagates to all designs automatically.

**Important:** When editing paths in subdirectory JS files (space/, terminal/), shared data paths must use `../` prefix (e.g., `fetch('../data/content.json')`).

## Architecture

**Single-page app pattern:** All content sections live in one `index.html`. Publications and news are loaded at runtime via `fetch()` from JSON files in `data/`.

### Data Files

**`data/publications.json`** — Array of publication objects:
```
{ id, title, authors[], year, venue, venue_full, type, selected, arxiv, code, pdf, poster, abstract }
```
- 25 papers (2019–2025) at NeurIPS, ICLR, ACL, EMNLP, AISTATS, TMLR, etc.
- `selected: true` marks featured papers
- `arxiv` is just the ID (e.g., `"2306.01708"`), rendered as `https://arxiv.org/abs/{id}`
- `pdf` is a filename relative to `assets/pdf/`
- `code`, `poster` are full URLs

**`data/news.json`** — Array of news objects:
```
{ date, content, links[{text, url}] }
```
- 24 items (2018–2024), sorted newest-first
- `date` is `YYYY-MM-DD` string

### Content to Preserve

When building any design variant, the following content must be included:

**Bio:** Works at Google DeepMind on Gemini. Previously Meta (pre-training: RL/thinking, architectures, data constraint scaling with Mike Lewis and Sharan Narang), Google DeepMind part-time (modular post-training), PhD at UNC Chapel Hill (advisors: Colin Raffel, Mohit Bansal), MSR Redmond, Amazon AWS AI Labs, MSR India, LinkedIn AI Bangalore, IISc Bangalore (B.S. Mathematics, 2018, supervised by Partha Talukdar).

**Research interests:** Pre-training, RL, Modular Models, Efficient Models, Adaptive LLMs, MoE, Model Merging

**Social links:**
- GitHub: `prateeky2806`
- Twitter: `prateeky2806`
- Google Scholar: `1lXhc0kAAAAJ&hl`
- LinkedIn: `prateek-yadav-40bb34a8`
- Semantic Scholar: `https://www.semanticscholar.org/author/Prateek-Yadav/46841632`
- Email: `praty2896@gmail.com`

**Profile photo:** `assets/img/hong_kong.jpg`

### Design Constraints

- Must deploy to GitHub Pages (static files only)
- Dark mode is required (can be dark-only or with light toggle)
- Must NOT look like a typical academic/professor template
- Color preference: cool tones (blues, purples, cyans)
- All 25 publications must render with correct links
- Author name "Prateek Yadav" should be visually highlighted in author lists

### neo-modern Design System (reference for the built branch)

**CSS Variables** control theming — dark/light mode switches via `[data-theme]` attribute on `<html>`. Theme persisted in `localStorage`, system preference detected via `prefers-color-scheme`.

**External dependencies (CDN only):**
- Google Fonts: Space Grotesk, Inter, JetBrains Mono
- Font Awesome 6.5.1 (social icons)
- Academicons (Google Scholar, DBLP icons)

**Key patterns:**
- Glassmorphism: `backdrop-filter: blur(20px)` + semi-transparent backgrounds
- Scroll reveal: Intersection Observer adds `.visible` class for fade-in
- Nav active tracking: Intersection Observer on sections updates pill indicator
- Publication venue colors: CSS classes `.venue-neurips`, `.venue-iclr`, etc.
- Responsive breakpoints: 768px (mobile layout), 480px (small mobile)

