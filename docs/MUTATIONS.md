# GraphQL MCP Server - Mutation Support

This document provides detailed information about the GraphQL MCP server's mutation support.

## Overview

The GraphQL MCP server now fully supports GraphQL mutations, allowing Claude to modify data through your GraphQL API, not just read it. Mutations follow the same general pattern as queries but with a special naming convention to clearly distinguish them.

## How Mutations Work

When the server starts, it:

1. Introspects the GraphQL schema to discover all available mutations
2. Creates MCP tools for each mutation, prefixed with `mutation_` to distinguish them from queries
3. Handles variable processing, execution, and result formatting just like with queries

## Configuration

### Mutation Whitelisting

For security reasons, you may want to limit which mutations Claude can access. The server supports mutation whitelisting through the `WHITELISTED_MUTATIONS` environment variable:

```json
"env": {
  "GRAPHQL_API_ENDPOINT": "https://example-graphql-api.com/graphql",
  "WHITELISTED_MUTATIONS": "[\"createUser\",\"updateProfile\"]"
}
```

As with queries, you can specify the whitelist in two formats:
- As a JSON array string: `"[\"mutation1\",\"mutation2\"]"` 
- As a comma-separated list: `"mutation1,mutation2,mutation3"`

If no whitelist is provided, all mutations from the GraphQL schema will be available.

## Using Mutations with Claude

### Tool Naming Convention

Mutation tools are named with the format: `mutation_<fieldName>`.

For example, if your GraphQL schema includes a mutation:

```graphql
mutation {
  createUser(name: String!, email: String!) {
    id
    name
    email
  }
}
```

The corresponding tool will be named `mutation_createUser`.

### Example Usage

Here's how to use a mutation tool with Claude:

```
View result from mutation_createUser from graphql (local){
  "name": "John Doe",
  "email": "john.doe@example.com"
}
```

For complex input types, provide them as JSON objects:

```
View result from mutation_updateProduct from graphql (local){
  "id": "prod-123",
  "input": {
    "name": "Updated Product Name",
    "price": 29.99,
    "description": "This is an updated product description"
  }
}
```

### Best Practices

1. **Use Whitelisting**: Always use the `WHITELISTED_MUTATIONS` environment variable to restrict which mutations are available to Claude, especially for APIs that handle sensitive data.

2. **Validate Input**: The server will handle basic type validation, but your GraphQL API should perform thorough validation of all input data.

3. **Provide Clear Feedback**: When implementing custom mutations, make sure they return meaningful error messages that Claude can understand and convey to the user.

4. **Idempotent Operations**: Where possible, design your mutations to be idempotent (repeating the same mutation with the same parameters has the same effect as executing it once).

## Technical Implementation

The mutation support is implemented in several key components:

1. **Schema Introspection**: The `getToolsFromMutationType` function analyzes the mutation fields in the GraphQL schema.

2. **Tool Generation**: Each mutation field is converted to an MCP tool with appropriate input parameters.

3. **Mutation Execution**: The `executeGraphQLMutation` function handles the execution of mutations with proper variable processing.

4. **Result Formatting**: Mutation results are returned in the same format as query results.

## Testing Mutations

The project includes a test script specifically for mutations. You can run it in two ways:

### Simulation Testing (no API key required)

```bash
npm run test:mutations
```

This will run the test in simulation mode without making real API calls.

### Live Testing with GitHub API

To test against the actual GitHub API, you need a GitHub token with appropriate permissions:

```bash
# Using the test script directly
GITHUB_TOKEN=your_token npm run test:mutations

# Or using the helper shell script
./test/run-mutation-test.sh your_token
```

The test will:
1. Connect to the GitHub GraphQL API
2. Fetch the available operations including mutations
3. Try to execute a star mutation (adding a star to a repository)
4. Verify that the mutation executed successfully

## Troubleshooting

### Common Issues

1. **Mutation Not Found**: If you receive "Unknown mutation" errors, check:
   - The mutation exists in your GraphQL schema
   - The mutation is properly named (without the `mutation_` prefix in your whitelist)
   - The mutation is included in your `WHITELISTED_MUTATIONS` (if using whitelisting)

2. **Variable Processing Errors**: For complex input types, make sure your JSON is properly formatted.

3. **Authorization Errors**: Ensure your `GRAPHQL_API_KEY` has the necessary permissions to perform the requested mutations.

### Debugging

When troubleshooting mutation issues, set the `DEBUG` environment variable to `true` to enable detailed logging:

```json
"env": {
  "DEBUG": "true"
}
```

This will log details about:
- Available mutations found in the schema
- Generated GraphQL mutation operations
- Variables being sent to the API
- Error messages from the GraphQL API
