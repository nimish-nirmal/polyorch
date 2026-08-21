# GitHub Pages Secrets Guide — PolyOrch

<!-- How to configure GitHub Pages secrets for the PolyOrch project -->

## Overview

The PolyOrch frontend is deployed to GitHub Pages using GitHub Actions. This guide explains how to configure the required secrets and settings.

---

## Required GitHub Secrets

### For Docker Image Publishing

The `.github/workflows/docker-publish.yml` workflow requires Docker Hub credentials:

| Secret Name | Description | How to Get |
| :--- | :--- | :--- |
| `DOCKER_USERNAME` | Docker Hub username | Your Docker Hub account name |
| `DOCKER_PASSWORD` | Docker Hub password or access token | Docker Hub → Account Settings → Security → New Access Token |

**To add secrets:**
1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its name and value

### For GitHub Pages Deployment

The `.github/workflows/deploy-frontend.yml` workflow uses the default GitHub Pages artifact deployment. No additional secrets are required if you use **GitHub Actions** as the Pages source.

**However, if you need to deploy to a custom domain or use a different Pages setup:**

| Setting | Value |
| :--- | :--- |
| **Source** | GitHub Actions |
| **Build and deployment** | GitHub Actions |
| **Custom domain** | Optional — configure in repository Settings → Pages |

---

## Enabling GitHub Pages

1. Go to repository **Settings** → **Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. The `deploy-frontend.yml` workflow will automatically deploy when you push changes to `web/`

---

## Workflow Configuration

### deploy-frontend.yml

This workflow triggers on changes to `web/**` files in the `main` branch:

```yaml
on:
  push:
    branches:
      - main
    paths:
      - "web/**"
```

**Required permissions:**
```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

### docker-publish.yml

This workflow triggers on push to `main` and tags `v*`:

```yaml
on:
  push:
    branches:
      - main
    tags:
      - "v*"
```

**Required secrets:**
- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`

---

## Troubleshooting

### Workflow fails with "pages: permission denied"

Ensure the workflow has `pages: write` and `id-token: write` permissions.

### Docker push fails with "unauthorized"

Verify `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets are set correctly. For Docker Hub, use an **Access Token** instead of your account password.

### Frontend deploys but shows 404

Check that `web/vite.config.ts` has the correct `base` path:
```ts
base: '/polyorch/'
```

### Frontend loads but API calls fail

The GitHub Pages frontend is a static site. It cannot serve API responses. You need a running PolyOrch backend instance and must update `VITE_API_URL` in `web/.env` to point to your backend server.

---

## Security Notes

- Never commit secrets or credentials to the repository
- Use GitHub encrypted secrets for all sensitive values
- Rotate Docker Hub access tokens regularly
- The `POLYORCH_API_KEY` should be set in your Docker Compose or Kubernetes secrets, not in GitHub Actions
