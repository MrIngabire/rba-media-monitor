# RBA AI Media Monitoring & Fake News Detection Platform

Case Study: Rwanda Broadcasting Agency. Bachelor's project — Mount Kigali University.

Full-stack: **Django 5 + DRF + SimpleJWT + PostgreSQL (SQLite fallback) + React + Vite + Tailwind v4**.

## Prerequisites
- Python 3.12
- Node 20
- (Optional) PostgreSQL 15+

## Setup (Windows PowerShell)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python manage.py makemigrations
python manage.py migrate
python manage.py seed_data --fresh
python manage.py runserver
```

New terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Login credentials

| Role | Email | Password |
|------|-------|----------|
| Analyst (author) | josue.rutayisire@rba.rw | RbaDemo2026! |
| Senior Editor (supervisor) | jean.delacroix@rba.rw | RbaDemo2026! |
| Analyst (secondary) | patrick.manzi@rba.rw | RbaDemo2026! |
| Administrator | admin@rba.rw | RbaDemo2026! |

## API summary

| Method | Endpoint | Role |
|--------|----------|------|
| POST | /api/auth/login/ | public |
| GET | /api/auth/me/ | any |
| GET | /api/dashboard/stats/ | any auth |
| GET | /api/articles/ | any auth |
| POST | /api/articles/scan/ | ANALYST |
| PATCH | /api/articles/{id}/route/ | ANALYST (author) |
| GET | /api/articles/editor_queue/ | EDITOR/ADMIN |
| POST | /api/articles/{id}/debunk/ | EDITOR |
| POST | /api/articles/{id}/verify/ | EDITOR |
| GET | /api/analytics/summary/ | EDITOR/ADMIN |
| GET | /api/analytics/export_pdf/ | EDITOR/ADMIN |
| GET/POST | /api/users/ | ADMIN |
| DELETE | /api/users/{id}/ | ADMIN |
| GET | /api/audit-logs/ | ADMIN |
| GET | /api/notifications/ | any auth |

See [docs/traceability.md](docs/traceability.md) for full requirement traceability.

## Project structure

```
project-root/
├── backend/        Django + DRF API
├── frontend/       React + Vite + Tailwind v4
├── docs/           traceability.md
└── README.md
```

## Deviations from book

- **D-1** (P-1): "Demo persona" quick-login buttons are kept on the login screen for defense convenience. Book doesn't forbid them. Impact: none — real JWT still required.
- **D-2** (P-4): NLP scoring is a deterministic heuristic (`_heuristic_score`) rather than a BERT model. Book §3.7 lists Python/Django, not an ML-serving stack. Impact: demo still shows differentiated fake probabilities; limitation documented in §7.
- **D-3** (P-2): Seed uses book-authoritative names (Josue RUTAYISIRE, Dr. Jean de la Croix). "Patrick MANZI" kept as a second analyst so the prototype's demo flow is preserved.