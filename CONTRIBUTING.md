# Contributing to A1Base AI Chat Agent

Thank you for your interest in contributing to the A1Base AI Chat Agent! We welcome contributions from the community and are excited to help you make this project better.

## 🤝 Code of Conduct

This project adheres to the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Exercise consideration and empathy
- Focus on constructive feedback
- Maintain a harassment-free experience for everyone

## 🚀 Getting Started

1. **Fork the Repository**
   - Click the 'Fork' button on GitHub
   - Clone your fork locally:
     ```bash
     git clone https://github.com/your-username/a1base-ai-agent
     cd a1base-ai-agent
     ```

2. **Set Up Development Environment**
   - Install dependencies:
     ```bash
     npm install
     ```
   - Copy environment configuration:
     ```bash
     cp .env.example .env.local
     ```
   - Configure your environment variables

3. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📝 Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow existing code formatting (Prettier configuration)
- Maintain consistent naming conventions
- Add JSDoc comments for functions and complex logic

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style updates
- `refactor:` Code refactoring
- `test:` Test updates
- `chore:` Maintenance tasks

Example:
```
feat: add message history persistence
```

### Pull Requests

1. **Before Submitting**
   - Update your fork to the latest main branch
   - Run tests: `npm test`
   - Ensure linting passes: `npm run lint`
   - Update documentation if needed

2. **PR Guidelines**
   - Provide a clear, descriptive title
   - Include relevant issue numbers
   - Add detailed description of changes
   - Include screenshots for UI changes
   - Update tests and documentation

3. **PR Template**
   ```markdown
   ## Description
   [Describe your changes]

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Documentation update
   - [ ] Code refactor
   - [ ] Other (please specify)

   ## Related Issues
   Fixes #[issue number]

   ## Testing
   [Describe how you tested your changes]

   ## Screenshots (if applicable)
   ```

## 🧪 Testing

- Write tests for new features
- Update existing tests when modifying features
- Ensure all tests pass before submitting PR
- Include both unit and integration tests where appropriate

## 📚 Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for new functions
- Update API documentation if endpoints change
- Include code examples for new features

## 🐛 Bug Reports

When filing an issue:

1. Use the bug report template
2. Include clear steps to reproduce
3. Provide environment details
4. Add relevant code snippets
5. Include error messages and logs

## ✨ Feature Requests

When proposing new features:

1. Use the feature request template
2. Explain the use case
3. Describe expected behavior
4. Provide example scenarios
5. Consider implementation approach

## 📋 Review Process

1. All PRs require at least one reviewer
2. Address review comments promptly
3. Maintain discussion in PR comments
4. Request re-review after updates
5. Squash commits before merging

## 🚀 Release Process

1. Version bumps follow [Semantic Versioning](https://semver.org/)
2. Update CHANGELOG.md with changes
3. Create release notes
4. Tag releases appropriately

## 💬 Getting Help

- Join our [Discord community](https://discord.gg/your-server)
- Check existing issues and discussions
- Reach out to maintainers
- Review documentation

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to making A1Base AI Chat Agent better for everyone! 🙏 