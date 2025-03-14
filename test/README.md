# GraphQL MCP Server Tests

This directory contains tests for the GraphQL MCP Server.

## Test Files

- `test-server.ts` - Integration test for the Countries GraphQL API
- `github-test.ts` - Integration test for the GitHub GraphQL API (requires authentication)

## Running Tests

### Basic Integration Test

Tests the server against the public Countries GraphQL API:

```bash
npm run test:server
```

### GitHub API Test

Tests the server against GitHub's GraphQL API, which requires authentication:

1. Copy `.env.sample` to `.env`:
   ```bash
   cp .env.sample .env
   ```

2. Edit `.env` and add your GitHub token
   ```
   GITHUB_TOKEN=your_github_token_here
   ```
   
   You can create a token at https://github.com/settings/tokens
   The token needs at least these permissions:
   - `repo` (for repository operations)
   - `read:user` (for user profile information)

3. Run the GitHub test:
   ```bash
   npm run test:github
   ```

## Adding New Tests

To add a new test for a different GraphQL API:

1. Create a new test file in this directory
2. Update package.json to add a new script for your test
3. Document any required configuration in this README

## Troubleshooting

- **Error: GitHub token not found**: Make sure you've created a `.env` file with your GitHub token
- **Error: Server file not found**: Run `npm run build` first to compile the TypeScript code
- **Authentication failures**: Check that your token has the necessary permissions
