# Security Policy

## 🛡️ Supported Versions

We actively maintain and provide security updates for the following versions of btget:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Yes             |
| < 1.0   | ❌ No              |

## 🚨 Reporting a Vulnerability

The btget team takes security bugs seriously. We appreciate your efforts to responsibly disclose your findings, and will make every effort to acknowledge your contributions.

### 📧 How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via:

1. **Email**: Send details to `utkarshweb2023@gmail.com`
2. **GitHub Security**: Use [GitHub's security advisory feature](https://github.com/UtkarshTheDev/btget/security/advisories/new)

### 📋 What to Include

When reporting a security vulnerability, please include:

- **Type of issue** (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- **Full paths** of source file(s) related to the manifestation of the issue
- **Location** of the affected source code (tag/branch/commit or direct URL)
- **Special configuration** required to reproduce the issue
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact** of the issue, including how an attacker might exploit it

### 🎯 Scope

The following are **IN SCOPE** for security reports:

- **Code execution** vulnerabilities
- **Authentication bypass**
- **Data exposure** or unauthorized access
- **Network protocol** vulnerabilities
- **Dependency vulnerabilities** affecting btget
- **Cryptographic** weaknesses
- **Input validation** issues
- **Path traversal** vulnerabilities

The following are **OUT OF SCOPE**:

- **DoS attacks** requiring excessive resources
- **Social engineering** attacks
- **Physical security** issues
- **Issues** in third-party dependencies (report to upstream)
- **Self-XSS** or similar client-side issues

## ⏰ Response Timeline

- **Acknowledgment**: Within 48 hours of report
- **Initial Assessment**: Within 1 week
- **Regular Updates**: Every week until resolved
- **Fix Development**: Depends on severity and complexity
- **Public Disclosure**: After fix is available and deployed

## 🏆 Severity Classification

### 🔴 Critical
- Remote code execution
- Privilege escalation
- Data breach potential

### 🟠 High  
- Significant security bypass
- Local code execution
- Sensitive data exposure

### 🟡 Medium
- Limited security bypass
- Information disclosure
- DoS vulnerabilities

### 🟢 Low
- Security configuration issues
- Minor information leaks
- Edge case vulnerabilities

## 🎖️ Security Hall of Fame

We maintain a hall of fame to recognize security researchers who responsibly disclose vulnerabilities:

<!-- Security researchers will be listed here -->
*No security reports have been made yet.*

## 🛠️ Security Practices

### Development
- **Code reviews** for all changes
- **Dependency scanning** with automated tools
- **Static analysis** integrated into CI/CD
- **Security-focused** testing

### Runtime
- **Minimal permissions** principle
- **Input validation** at all boundaries
- **Secure defaults** in configuration
- **Regular updates** of dependencies

### Distribution
- **Signed releases** (coming soon)
- **Checksums** for all artifacts
- **Secure package** distribution via npm
- **Vulnerability scanning** of containers

## 🔄 Security Update Process

1. **Vulnerability** identified and confirmed
2. **Fix developed** in private branch
3. **Testing** performed on fix
4. **Security advisory** prepared
5. **Release** with security fix
6. **Public disclosure** after users have time to update

## 📋 Security Checklist for Contributors

When contributing to btget, please consider:

- [ ] **Input validation** - All user inputs are properly validated
- [ ] **File operations** - Safe file handling without path traversal
- [ ] **Network operations** - Secure protocol usage
- [ ] **Dependencies** - No known vulnerabilities in new deps
- [ ] **Error handling** - No sensitive information in error messages
- [ ] **Logging** - No sensitive data logged
- [ ] **Permissions** - Principle of least privilege

## 🔗 Security Resources

### General Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE (Common Weakness Enumeration)](https://cwe.mitre.org/)
- [CVE Database](https://cve.mitre.org/)

### Node.js Security
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [npm Security](https://docs.npmjs.com/about-security)

### BitTorrent Protocol Security
- [BitTorrent Protocol Specification](http://www.bittorrent.org/beps/bep_0003.html)
- [BitTorrent Security Considerations](http://www.bittorrent.org/beps/bep_0052.html)

## 📞 Contact

For security-related questions or concerns:

- **Email**: utkarshweb2023@gmail.com
- **GitHub**: [@UtkarshTheDev](https://github.com/UtkarshTheDev)

---

**Remember**: If you discover a security vulnerability, please report it responsibly to help keep btget and its users safe! 🛡️
