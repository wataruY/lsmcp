# Oxlint Migration Notes

## Performance Improvement
- ESLint: ~5.4 seconds
- Oxlint: ~0.3 seconds
- **17x faster** linting!

## Migration Details

### Scripts Updated
- `pnpm lint` - Now uses oxlint instead of eslint
- `pnpm lint:refactor` - Uses oxlint with --deny-warnings flag
- `pnpm lint:eslint` - Kept as fallback to run original eslint

### Configuration
- Created `oxlintrc.json` with most ESLint rules migrated
- Most TypeScript and ESLint rules are supported

### Limitations
- Custom `no-class` rule is not directly supported in oxlint
- Using `typescript/no-extraneous-class` and `unicorn/no-static-only-class` as alternatives
- The custom rule from `eslint.config.ts` that completely bans all classes is not available

### Available Commands
```bash
# View all available oxlint rules
npx oxlint --rules

# Run oxlint
pnpm lint

# Run with warnings as errors
pnpm lint:refactor

# Fallback to ESLint if needed
pnpm lint:eslint
```