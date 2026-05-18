# Security Policy

KIIP Study handles authentication (Google OAuth + magic-link), JWT sessions, admin actions, and uploaded files. We take security reports seriously.

## Reporting a Vulnerability

**Preferred channel:** GitHub's [Private Vulnerability Reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability).

1. Go to the **Security** tab of this repository → **Advisories** → **Report a vulnerability**.
2. Include:
   - A clear description of the issue
   - The affected version (commit SHA, tag, or `main` if unreleased)
   - Steps to reproduce
   - Your assessment of impact + likely attack surface
3. Please **do not** open a public GitHub issue for security findings — that's the disclosure step, not the report step.

If you can't use the GitHub flow (e.g. your account is suspended), open a minimally-revealing public issue titled "Security disclosure — request private contact" with no technical details, and a maintainer will reach out.

## Response Targets

- **Acknowledgement:** within **7 days** of the report.
- **Triage + severity assessment:** within **14 days**.
- **Fix shipped (high/critical):** within **30 days** for issues that allow account compromise, data exfiltration beyond the reporter, RCE, or service-wide DoS.
- **Fix shipped (medium):** within **90 days** for issues that affect a single user / single admin / single test record.
- **Fix shipped (low):** at the next scheduled release for hardening / information-disclosure with no exploit path.

If we exceed these targets we'll explain why in the advisory.

## Coordinated Disclosure

Default policy: **90-day coordinated disclosure**. We ask reporters to keep findings private until either:
- A fix has shipped to `main` and operators have had ≥7 days to deploy, **or**
- 90 days have elapsed since the report and we have not delivered a fix.

Reporters who want shorter / longer windows can request that in the report; we'll meet you where we can.

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` branch (latest commit) | ✅ |
| Tagged releases (`vX.Y.Z`)    | Only the most recent tag |
| Forks / third-party hosted instances | ❌ — report to the host |

## Out of Scope

- Vulnerabilities in third-party services we integrate (Google OAuth, Gemini API). Report those to the vendor.
- Dev-mode `.env.example` placeholder secrets — those are intentional placeholders.
- Self-hosted instances misconfigured by the operator (e.g. running without `mongod --auth`, with `JWT_SECRET=test`, with a stale unpatched commit). These are documented hardening steps, not project vulnerabilities.
- DOS via direct internet exposure of the development server (`npm run dev`) — dev is not intended to be internet-exposed.

## Hall of Fame

After a fix ships, we credit reporters in the corresponding GitHub Security Advisory unless they request anonymity.
