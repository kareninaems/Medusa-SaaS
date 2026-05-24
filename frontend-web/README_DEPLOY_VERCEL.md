# Deploy rápido (Vercel) — frontend-web

## Configuração no projeto Vercel
- Root Directory: `frontend-web`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

## Rewrites SPA
Arquivo já incluído: `frontend-web/vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## Variáveis de ambiente (Vercel)
Copiar do `.env` do `frontend-web`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_TERMS_VERSION`
- `VITE_PRIVACY_VERSION`

## Validação local antes do deploy
```bash
cd frontend-web
npm install
npm run build
```
