# Aryan Tyagi — 3D résumé

A scroll-driven 3D résumé: one fixed three.js stage behind scrolling HTML. Scrolling moves
the camera — hero shot, one close-up per résumé entry, then a turn into a sideways works
gallery. The character changes pose per section, its eyes and head follow the cursor, and
whatever the camera is aimed at stays sharp while the rest falls out of focus.

Static site, no build step.

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. (It must be served over HTTP; opening `index.html`
directly from disk will not load the JavaScript modules.)

## Where things live

| What | Where |
| --- | --- |
| Hero copy, résumé entries, works gallery cards | `index.html` |
| What opens when a work is clicked | `WORKS` at the top of `assets/js/main.js` |
| Styling | `assets/css/style.css` |
| Camera shots, poses, eye positions, motion amounts | constants at the top of `assets/js/scene.js` |
| Character images (cut out, transparent) | `assets/character/pose-N.webp` |
| Original character images and the cut-out tool | `tools/source/`, `tools/matte.html`, `tools/build-character.sh` |
| Film grain | `assets/js/noise.js` |
| CV source and exported PDF | `cv.html` → `assets/Aryan-Tyagi-CV.pdf` |

`NODE_SHOTS` in `scene.js` lists one camera shot per `.tl-entry` block in `index.html`, in
order; add or remove them together. Each shot names a pose and the pixel on that image the
camera aims at.

The character is a set of rendered stills, not a 3D model. To replace a pose, put the new
image in `tools/source/`, run `tools/build-character.sh` (with the local server running), and
update that pose's eye and neck positions in `POSES`.

To re-export the CV after editing `cv.html`, open it in Chrome and print to PDF
(A4, no margins, no headers and footers).

## Deploy

Any static host works (Vercel, Netlify, GitHub Pages, Cloudflare Pages): publish the
repository root, no build command. three.js is loaded from the jsDelivr CDN, pinned to
0.169.0, via the import map in `index.html`.

## Credits

The layout, styling and scroll-to-camera approach are adapted from the MIT-licensed code of
[sen-3d-resume](https://github.com/dayinji/sen-3d-resume); see `THIRD_PARTY_LICENSES.md`.
The character images and all content are Aryan's own. `legacy/` holds the previous Flask
version of this site and is not used.
