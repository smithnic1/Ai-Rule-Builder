## AI Rule Builder – Dev Quick Start

Run both backend and frontend with one command:

```bash
npm install   # only needed once to install the root dev helper dependency
npm run dev
```

The script does the following:

1. `cd backend/RuleBuilder.Api && dotnet watch run`
2. `cd frontend/rule-builder-ui && npm run dev -- --host 0.0.0.0 --port 5174`

Make sure `backend/RuleBuilder.Api/.env` contains a valid `OPENAI_API_KEY` (copied from `.env.example`) before running `npm run dev`. The backend already loads that file automatically.

When you’re done, hit `Ctrl+C` once and both processes stop together.
