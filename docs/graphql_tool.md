# GraphQL MCP Tool

This document describes the GraphQL MCP tool implementation for Lambda-MCP, which provides a bridge between Claude and GraphQL APIs.

## Overview

The GraphQL MCP tool allows Claude to interact with GraphQL APIs by:

1. Introspecting GraphQL schemas to understand their structure
2. Executing GraphQL queries against endpoints
3. Parsing and processing the results

## Features

- **Schema Introspection**: Retrieve and analyze GraphQL schema structure
- **Query Execution**: Run GraphQL queries with variables and custom headers
- **Schema Caching**: Cache introspected schemas for better performance
- **Error Handling**: Proper error management and reporting
- **Security**: Input sanitization and validation

## Tools

### 1. introspect_schema

This tool retrieves and analyzes the GraphQL schema from an endpoint.

#### Parameters

| Name | Type | Description | Required | Default |
|------|------|-------------|----------|---------|
| endpoint | string | The GraphQL endpoint URL | Yes | - |
| headers | object | HTTP headers to include in the request | No | {} |
| force_refresh | boolean | Force a refresh of the cached schema | No | false |

#### Response

```json
{
  "schema": {
    "queryType": "Query",
    "mutationType": "Mutation",
    "subscriptionType": null,
    "types": [
      {
        "name": "Query",
        "kind": "OBJECT_TYPE_DEFINITION",
        "description": "The root query type"
      },
      // Additional types...
    ]
  },
  "meta": {
    "endpoint": "https://example.com/graphql",
    "execution_time_ms": 123
  }
}
```

### 2. execute_query

This tool executes a GraphQL query against an endpoint.

#### Parameters

| Name | Type | Description | Required | Default |
|------|------|-------------|----------|---------|
| endpoint | string | The GraphQL endpoint URL | Yes | - |
| query | string | The GraphQL query to execute | Yes | - |
| variables | object | Variables for the GraphQL query | No | {} |
| headers | object | HTTP headers to include in the request | No | {} |

#### Response

```json
{
  "result": {
    // The raw GraphQL response data
  },
  "meta": {
    "execution_time_ms": 123,
    "endpoint": "https://example.com/graphql"
  }
}
```

## Setting Up Local Development

### Running the GraphQL MCP Server Locally

```bash
# Install dependencies
npm install

# Start the development server
npm run dev:graphql
```

The server will run at http://localhost:3001 with the MCP endpoint available at http://localhost:3001/mcp/graphql.

### Docker Setup

You can also run the GraphQL MCP server in a Docker container:

```bash
# Build the Docker image
npm run docker:build:graphql

# Run the container
npm run docker:run:graphql
```

### Integrating with Claude Desktop

Use our automated setup script to integrate with Claude Desktop:

```bash
npm run setup:claude:graphql
```

This will:
1. Build the Docker image for the GraphQL MCP server
2. Update your Claude Desktop configuration
3. Provide instructions for setting up the tool in Claude Desktop

## Example Usage

Here are some examples of using the GraphQL MCP tool with Claude:

### Introspecting a Schema

```
Use GraphQL MCP to introspect the schema of https://swapi-graphql.netlify.app/.netlify/functions/index
```

### Executing a Query

```
Use GraphQL MCP to execute the following query against https://swapi-graphql.netlify.app/.netlify/functions/index:

query {
  allFilms {
    films {
      title
      releaseDate
      director
    }
  }
}
```

### Using with Authentication

```
Use GraphQL MCP to execute a query against https://api.example.com/graphql with the following headers:
{
  "Authorization": "Bearer YOUR_TOKEN"
}

Here's the query:
query GetUserInfo {
  currentUser {
    id
    name
    email
  }
}
```

## Security Considerations

When using the GraphQL MCP tool, be aware of the following security considerations:

1. **Authentication**: Be careful with authentication tokens. The tool allows passing headers, which can include sensitive tokens.
2. **Query Validation**: All queries are validated before execution to prevent malformed requests.
3. **Endpoint Validation**: URLs are sanitized to prevent potential injection attacks.
4. **Error Handling**: Errors are properly captured and logged without exposing sensitive information.

## Implementation Details

The GraphQL MCP tool uses:

- **graphql** package for parsing and validating GraphQL queries
- **graphql-request** for executing queries against endpoints
- Schema caching to optimize performance for repeated schema introspections

## Next Steps

Future enhancements to the GraphQL MCP tool may include:

1. **Schema Visualization**: Generating visual representations of GraphQL schemas
2. **Query Building**: Assisting with query construction based on schema information
3. **Persistent Caching**: Storing schema information in a persistent cache
4. **Rate Limiting**: Adding protection against excessive query execution
5. **Mutations Support**: Enhanced support for executing GraphQL mutations

For more information or to contribute, please see the [main project documentation](./README.md).
