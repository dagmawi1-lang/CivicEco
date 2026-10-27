# CivicEco Security Notes

## Current protections
- Passwords are hashed with Node.js `scrypt`.
- Sessions expire automatically.
- Authentication endpoints are rate-limited.
- API requests are rate-limited.
- JSON request bodies have a size limit.
- Responses include basic security headers.
- Database writes use a temporary file and atomic rename.
- Optional database backups can be enabled with `BACKUP_DB=true`.

## Production checklist
Before deploying publicly, use HTTPS, a managed database, a persistent session store, secure cookies or another hardened token strategy, a secrets manager, image/file scanning, monitoring, and a formal security review.

CivicEco is a school/competition project and should not be presented as production-hardened until those controls are completed.
