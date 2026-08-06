# Maplog — GitHub Pages Deployment

## Live URL

**<https://nmartinous.github.io/maplog/>**

## One-time setup (new repo only)

After the first push, enable GitHub Pages in the repository settings:

1. Go to **https://github.com/nmartinous/maplog/settings/pages**
2. Under **Source**, select **GitHub Actions**
3. Save — future pushes will deploy automatically

## Deploying an update

From Replit, run the **Push to GitHub** task (or execute the script directly):

```bash
bash scripts/push-to-github.sh
```

This pushes `main` to GitHub. The Actions workflow builds the Maplog artifact
and publishes it to GitHub Pages within ~2 minutes.

## How it works

| Step | Tool |
|------|------|
| Trigger | `git push origin main` |
| CI/CD | `.github/workflows/deploy.yml` |
| Build command | `pnpm --filter @workspace/maplog run build` |
| Build output | `artifacts/maplog/dist/public/` |
| Hosting | GitHub Pages (via `actions/deploy-pages`) |

## Notes

- Apple Music secrets remain in Replit and are **not** pushed to GitHub.
- The GitHub Actions workflow does not need any repository secrets for the build.
- The base path is set to `/maplog/` so all assets and routes resolve correctly under the GitHub Pages subpath.
