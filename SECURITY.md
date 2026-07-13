# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

NyxTrace is a digital forensics platform handling potentially sensitive evidence data.
If you discover a security vulnerability, please do **not** open a public issue.

Send details to: **projectphase35@gmail.com**

You should receive a response within 48 hours. If you don't, please follow up.

### What to include

- Type of vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Any suggested fix (optional)

## Scope

The following are in scope for security reports:

- Authentication and authorization bypass
- Data leakage or improper access control
- Injection vulnerabilities (NoSQL, command, template)
- Cryptographic weaknesses
- Remote code execution

## Out of scope

- Missing rate limiting (we track this separately)
- Self-XSS
- Social engineering attacks

## Disclosure Policy

We follow a **90-day disclosure timeline**: you report, we fix, then we coordinate
public disclosure after the fix is released. We'll credit you in the release notes
unless you prefer to remain anonymous.
