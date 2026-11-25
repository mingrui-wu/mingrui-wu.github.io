# Mingrui Wu — personal website

Static HTML, CSS and JavaScript published with GitHub Pages:

- [Personal homepage](https://mingrui-wu.github.io/)
- [OSI-Bench project page](https://mingrui-wu.github.io/osi-bench/)

## Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Biography, contact links and publications |
| `files/` | Homepage stylesheet, portrait, favicon and paper thumbnail |
| `osi-bench/index.html` | Paper content, authors, results and citation |
| `osi-bench/static/` | Project-page styles, answer interaction and images |
| `openbench/`, `openbench-or/` | Compatibility redirects to `/osi-bench/` |
| `codex/` | Maintenance checklist and verification record |

## Local preview

From the repository root, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/` and `http://127.0.0.1:8000/osi-bench/`.
For a checkout on a remote host, forward port 8000 to your computer first.
There is no dependency installation or build step. `.nojekyll` serves the files
directly without applying a Jekyll theme.

## Updating and publishing

Update the homepage in `index.html` and `files/doc.css`. Update the paper page in
`osi-bench/index.html`, its CSS in `osi-bench/static/css/index.css`, and its answer
button in `osi-bench/static/js/index.js`. Keep publication metadata and citations
consistent between the two pages. Keep results tied to the paper's real data.

Before committing, check both pages on desktop and mobile, test the answer button
with mouse and keyboard, and check the browser console and resource requests.
Run `node --check osi-bench/static/js/index.js` and `git diff --check`.

Push the verified commit to `master`, the repository's current publishing branch.
Check the GitHub Pages deployment result after pushing. Keep both old project URLs
as redirects; do not copy the paper page or assets back into those directories.
Older page versions and removed assets remain available in Git history.

PNG files have been compressed without changing their decoded image data.
The two carousel image sequences are intentional copies in the HTML for a seamless
animation; they share the same image files.

## Credits

The project page uses [Bulma](https://github.com/jgthms/bulma) (MIT) and derives from
the [Nerfies website template](https://github.com/nerfies/nerfies.github.io).
Its existing Creative Commons Attribution-ShareAlike 4.0 notice is retained.
