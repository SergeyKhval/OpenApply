# Contributing to OpenApply

Thanks for considering contributing to OpenApply. Here's what you need to know.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a branch for your feature/fix
4. Make your changes
5. Submit a pull request

## Development Setup

### Prerequisites
- Node.js v20+
- pnpm v10.16.1+
- Firebase CLI
- A Firebase project for testing

### Installation
```bash
# Clone the repo
git clone https://github.com/SergeyKhval/OpenApply.git
cd openapply

# Install dependencies
pnpm install

# Set up environment variables
cp spa/.env.example spa/.env.local
cp astro/.env.example astro/.env.local
# Edit the .env.local files with your Firebase config

# Start development
cd spa && pnpm dev
```

## Code Standards

### TypeScript
- Use TypeScript types over interfaces
- Use object destructuring for default props
- Don't add redundant comments

### Vue Components
- Use Composition API with `<script setup>`
- Follow existing component patterns in `src/components/ui/`
- Use Tailwind CSS for styling

### Git Commits
- Keep commits focused on a single change
- Write clear commit messages
- Reference issue numbers when applicable

Example:
```
fix: resolve application status not updating

Fixes #123
```

## Testing Your Changes

Before submitting:
1. Run type checking: `pnpm type-check`
2. Test the build: `pnpm build`
3. Test with Firebase emulators if your changes affect backend functionality

## Submitting Pull Requests

1. **One PR = One Feature/Fix** - Don't bundle unrelated changes
2. **Describe your changes** - What does it do? Why is it needed?
3. **Include screenshots** - For UI changes
4. **Reference issues** - Link related issues
5. **Keep it clean** - No debug code, console.logs, or commented code

## What We're Looking For

✅ Bug fixes
✅ Performance improvements
✅ New features that align with the project goals
✅ Documentation improvements
✅ Test coverage

## What We're NOT Looking For

❌ Major architecture changes without discussion
❌ Adding heavy dependencies without justification
❌ Breaking changes to existing APIs
❌ Features that complicate the core user experience

## Questions?

Open an issue for discussion before starting major work. We'll save everyone time.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.