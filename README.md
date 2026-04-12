# cven.cc — Civil Engine Tools Hub

Cloudflare Worker with static assets serving cven.cc.

## Structure

```
~/Dev/cven/
├── public/                          → Static files served at cven.cc
│   ├── index.html                   → cven.cc (logo landing page)
│   ├── civil-engine-logo.png        → ⚠️ YOU ADD THIS
│   ├── central/
│   │   └── index.html               → cven.cc/central (project hub)
│   └── nextgm/
│       └── avatar-forge.html        → cven.cc/nextgm/avatar-forge
├── src/
│   └── index.js                     → Worker: static assets + /api/fal proxy
├── wrangler.jsonc                   → Cloudflare config
├── package.json
└── README.md
```

## Deploy

```bash
cd ~/Dev/cven
npx wrangler deploy
```

## Add the fal.ai secret (first time only)

```bash
npx wrangler secret put FAL_KEY
```

## Connect cven.cc domain

Cloudflare dashboard → Workers & Pages → cven-cc → Settings → Domains & Routes → Add cven.cc
