# Security Rules

- Never commit secrets, tokens, private keys, or real credentials.
- Validate and authorize all user-controlled inputs at trust boundaries.
- Treat authentication, authorization, payments, PII, and external integrations as threat-model triggers.
- Record security exceptions with owner, compensating controls, and expiry date.
- Block releases with critical or high unresolved findings unless `cto-governance` approves an exception.
