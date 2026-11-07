# Supabase (Module 0)

Project: `shaqaf-energy` (eu-central-1). Migrations here were applied in order: 0001, 0002, 0003.

Covered: accounts (customer / company / supplier), organizations with roles (admin, engineer, technician, procurement),
projects with separate `design_auto` (customer) and `design_manual` (company), invites, events, quotes, and row level
security. Suppliers/procurement tables arrive in Module 6.

Isolation was verified with 24 checks run as different users inside a rolled-back transaction
(customers, two companies, a technician, anonymous). Security advisor: no findings.
No keys are stored in this repo.
