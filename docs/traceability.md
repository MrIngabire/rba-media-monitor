# Traceability

## Use cases → endpoints → screens

| UC | Endpoint | Screen | Book Ref |
|----|----------|--------|----------|
| UC-01 Sign in | POST /api/auth/login/ | /login | Fig 5.1 |
| UC-02 Me | GET /api/auth/me/ | global | §Ground rules |
| UC-03 Dashboard stats | GET /api/dashboard/stats/ | /dashboard | Fig 5.2 |
| UC-04 List articles | GET /api/articles/ | /dashboard | Fig 5.2 |
| UC-05 Scan | POST /api/articles/scan/ | /scan | Fig 5.3 |
| UC-06 Route | PATCH /api/articles/{id}/route/ | /scan | Fig 5.3 |
| UC-07 Editor queue | GET /api/articles/editor_queue/ | /editor | Fig 5.4 |
| UC-08 Debunk | POST /api/articles/{id}/debunk/ | /editor | Fig 5.4 |
| UC-09 Verify | POST /api/articles/{id}/verify/ | /editor | Fig 5.4 |
| UC-10 Analytics | GET /api/analytics/summary/ | /analytics | Fig 5.5 |
| UC-11 PDF export | GET /api/analytics/export_pdf/ | /analytics | Fig 5.5 |
| UC-12 Admin overview | GET /api/admin/overview/ | /admin | Fig 5.6 |
| UC-13 Users CRUD | GET/POST /api/users/ | /admin | Fig 5.6 |
| UC-14 Delete user | DELETE /api/users/{id}/ | /admin | Fig 5.6 |
| UC-15 Audit logs | GET /api/audit-logs/ | /admin | Fig 5.6 |
| UC-16 Notifications | GET /api/notifications/ | header bell | Fig 5.4 |
| UC-17 Refresh/logout | POST /api/auth/refresh/, /logout/ | global | Fig 5.1 |

## Business rules → enforcement
See Phase 4 Table D'.

## Deviations
- D-1: Demo persona quick-login retained (see README).
- D-2: Heuristic NLP scorer instead of BERT (see README).
- D-3: Seed uses book-authoritative names.