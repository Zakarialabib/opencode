# Security Policy

---

## Reporting Security Vulnerabilities

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Send an email to: `[security contact email]`
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

### What to Expect

| Timeline            | Action                             |
| ------------------- | ---------------------------------- |
| **Within 24 hours** | Acknowledgment of your report      |
| **Within 48 hours** | Initial assessment and triage      |
| **Within 7 days**   | Status update on the vulnerability |
| **Within 30 days**  | Fix development and testing        |
| **Within 60 days**  | Release of fix (if applicable)     |

### What We Promise

- We will not pursue legal action against good-faith researchers
- We will credit researchers in security advisories (with permission)
- We will keep you informed throughout the resolution process
- We will follow responsible disclosure practices

---

## Supported Versions

| Version | Supported                |
| ------- | ------------------------ |
| 2.0.x   | ✅ Yes                   |
| 1.x.x   | ⚠️ Security patches only |
| < 1.0   | ❌ No                    |

---

## Security Best Practices

### API Keys and Secrets

- Never commit API keys, tokens, or secrets to the repository
- Use environment variables via `.env` file (see `.env.example`)
- The `.env` file is in `.gitignore` and must never be committed
- Rotate keys immediately if accidentally exposed

### Code Security

- All user inputs should be validated and sanitized
- Use `execFile` instead of `exec` for subprocess execution to avoid shell injection
- Plugins should declare required permissions
- MCP server commands are validated before execution

### Database Security

- The SQLite database (`database.sqlite`) is not tracked in git
- Each user maintains their own local database
- The database is created automatically on first run
- Consider encrypting sensitive data stored in the database

### Dependency Security

- Dependencies are audited regularly via `npm audit`
- Automated dependency updates via Dependabot
- Pin dependency versions for reproducibility

---

## Security Audit Checklist

- [ ] No secrets committed to repository
- [ ] API keys loaded from environment variables
- [ ] Input validation on all user-facing commands
- [ ] Plugin permissions enforced at runtime
- [ ] MCP server arguments sanitized
- [ ] Database not tracked in version control
- [ ] Dependencies up to date with no known vulnerabilities
- [ ] `.env` file in `.gitignore`
- [ ] Logs do not contain sensitive information

---

## Vulnerability Disclosure Timeline

We follow a 90-day responsible disclosure timeline:

1. **Day 0**: Report received and acknowledged
2. **Day 1-2**: Triage and impact assessment
3. **Day 3-14**: Fix development
4. **Day 15-21**: Testing and code review
5. **Day 22-28**: Patch release preparation
6. **Day 29**: Public disclosure and advisory
7. **Day 30-90**: User notification and upgrade support
