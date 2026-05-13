# ERP Frontend (Next.js)

## What is implemented
- Next.js app router frontend with production-style structure.
- Pages:
  - `/` dashboard
  - `/devices`
  - `/devices/:id`
  - `/devices/:id/revisions/:revisionId`
- API integration to backend endpoints:
  - devices list
  - revisions list
  - BOM
  - tasks
  - cost breakdown

## Run
```bash
cd apps/frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:3000 npm run dev
```

Frontend runs on `http://localhost:3001`.

## Notes
- This is SSR-first and API-driven.
- Styling intentionally minimal for engineering readability.
