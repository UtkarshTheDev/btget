# Pull Request

## 📋 Description

Brief description of the changes in this PR.

## 🎯 Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🔧 Refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test coverage improvement

## 🔗 Related Issues

- Fixes #issue-number
- Related to #issue-number
- Part of #issue-number

## 🧪 Testing

### Test Environment
- [ ] Tested on Linux
- [ ] Tested on macOS
- [ ] Tested on Windows
- [ ] Tested with Node.js 18+
- [ ] Tested with Bun

### Manual Testing Performed
- [ ] Built successfully (`bun run build`)
- [ ] All existing commands work
- [ ] New functionality works as expected
- [ ] Error handling works properly
- [ ] Performance is acceptable

### Test Commands Used
```bash
# List the commands you used to test
btget --help
btget info test.torrent
btget test.torrent -o /tmp/test
```

## 📸 Screenshots (if applicable)

Add screenshots or terminal output showing the changes.

```bash
# Before
$ btget old-behavior

# After  
$ btget new-behavior
```

## ✅ Checklist

### Code Quality
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works

### Documentation
- [ ] I have updated the documentation where necessary
- [ ] I have updated the README.md if needed
- [ ] I have updated CHANGELOG.md
- [ ] Any new dependencies are documented

### Dependencies
- [ ] No new dependencies added
- [ ] If dependencies added, they are justified and documented
- [ ] All dependencies are compatible with project requirements

### Performance
- [ ] My changes don't negatively impact performance
- [ ] Bundle size impact is acceptable
- [ ] Startup time impact is minimal

### Backward Compatibility
- [ ] My changes are backward compatible
- [ ] If breaking changes, they are documented and justified
- [ ] Migration guide provided if needed

## 📊 Performance Impact

### Bundle Size
- Current size: _____ KB
- New size: _____ KB  
- Impact: _____ KB (+ increase / - decrease)

### Startup Time
- Before: _____ ms
- After: _____ ms
- Impact: _____ ms difference

## 🔍 Review Focus Areas

Please pay special attention to:

- [ ] Security implications
- [ ] Performance impact
- [ ] Error handling
- [ ] Cross-platform compatibility
- [ ] API design consistency
- [ ] Documentation completeness

## 💡 Additional Notes

Any additional information that reviewers should know:

- Design decisions and alternatives considered
- Known limitations or trade-offs
- Future improvements planned
- Migration considerations

---

## For Maintainers

### Release Notes
```markdown
<!-- Copy/paste for release notes if needed -->
- Added: New feature description
- Fixed: Bug fix description
- Changed: Breaking change description
```

### Review Checklist
- [ ] Code quality is acceptable
- [ ] Tests pass and coverage is adequate
- [ ] Documentation is updated
- [ ] Performance impact is acceptable
- [ ] Security review completed (if applicable)
- [ ] Breaking changes are documented
- [ ] CHANGELOG.md is updated