# Independent-hosting Estate authentication

This code is prepared for an independent Python deployment. It is deliberately inactive on the current Sites host, which retains ChatGPT sign-in. Publishing on Sites does not activate email/password login.

`estate_auth.py` provides a standard-library WSGI middleware with persistent SQLite users, scrypt password hashing, server-stored hashed session tokens, eight-hour Secure/HttpOnly/SameSite cookies, origin checks, login throttling, logout, and a server-controlled admin email allowlist. Client registration cannot claim an admin email.

Wrap the production Python application:

```python
from deployment.estate_auth import EstateAuth
application = EstateAuth(
    existing_application,
    database='/persistent/siege-estate-accounts.sqlite3',
    origin='https://www.sieg.ltd',
    admin_emails=['YOUR_VERIFIED_STAFF_EMAIL'],
)
```

The middleware handles `/api/property/status`, `/register`, `/login`, and `/logout`. The frontend automatically displays email/password login only when status returns `authMode: email-password`. Registration then requires name, email, country code + cellphone, password and consent. Current Sites behavior stays unchanged.

Launch integration still required:

- Deploy behind HTTPS using a production WSGI server; keep SQLite on a persistent, access-restricted volume and back it up. Use a shared database/session store before running multiple independent hosts.
- Connect existing property listing/media routes to the independent backend. Authorize ownership using `environ['siege.user']['id']` and staff actions using `environ['siege.is_admin']`; never trust identity headers supplied by visitors. The middleware does not port the current Worker/D1/R2 listing API.
- Existing ChatGPT-linked clients need an explicit verified account-migration process; their records are not automatically transferred.
- Provision staff credentials privately in the database with `EstateAuth.password()`; public registration rejects staff addresses. Never put passwords in source, command-line arguments or logs.
- Configure transactional email and implement email verification and password recovery before opening public registration. This module does not yet send verification or reset emails.
- Set the exact production origin and connect www.sieg.ltd. Merely changing the domain does not enable these routes on Sites.

Run `python3 -B deployment/test_estate_auth.py` for registration/login/logout, hashing, session privacy, admin restrictions, origin and rate-limit checks.
