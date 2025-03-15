# GraphQL Query Whitelisting

This document provides detailed instructions for using the query whitelisting feature in the GraphQL MCP Server.

## Overview

The query whitelist feature allows you to restrict which GraphQL queries are exposed to Claude. This is useful for:

- Security: Limiting access to sensitive operations
- Performance: Exposing only the queries that are relevant for your use case
- Simplicity: Reducing the number of tools displayed to Claude

## Configuration

The whitelist is configured through the `WHITELISTED_QUERIES` environment variable. If this variable is not set, all queries from the GraphQL schema will be available.

### Format Options

The whitelist can be specified in two formats:

#### 1. Comma-separated list (recommended for .env files)

```
WHITELISTED_QUERIES=countries,continent,languages
```

This format is simple and doesn't require escaping quotes, making it ideal for `.env` files.

#### 2. JSON array string (required for JSON config files)

```json
"WHITELISTED_QUERIES": "[\"countries\",\"continent\",\"languages\"]"
```

This format is more complex but might be required in some contexts, especially in JSON configuration files like the Claude Desktop config.

### Environment File Example (.env)

```
# GraphQL MCP Server Environment Variables
GRAPHQL_API_ENDPOINT=https://countries.trevorblades.com/graphql
DEBUG=true
WHITELISTED_QUERIES=countries,continent,languages
```

### Claude Desktop Configuration Example

```json
{
  "mcpServers": {
    "graphql-countries": {
      "command": "node",
      "args": [
        "/Users/username/Projects/graphql-mcp/dist/graphql-mcp-server.js"
      ],
      "env": {
        "GRAPHQL_API_ENDPOINT": "https://countries.trevorblades.com",
        "NODE_ENV": "development",
        "DEBUG": "true",
        "WHITELISTED_QUERIES": "[\"countries\",\"continent\",\"cities\"]"
      }
    }
  }
}
```

## Common Mistakes

### 1. Using an actual array instead of a string in JSON config

```json
// INCORRECT ❌
"WHITELISTED_QUERIES": ["countries", "continent", "languages"]

// CORRECT ✓
"WHITELISTED_QUERIES": "[\"countries\",\"continent\",\"languages\"]"
```

Environment variables must be strings, even in JSON configuration files.

### 2. Missing or incorrect escaping of quotes

```json
// INCORRECT ❌
"WHITELISTED_QUERIES": "["countries","continent","languages"]"

// CORRECT ✓
"WHITELISTED_QUERIES": "[\"countries\",\"continent\",\"languages\"]"
```

In JSON strings, quotes must be escaped with a backslash.

## Server Output

When the server starts, it will log whether the whitelist is enabled and how many queries are allowed:

```
GraphQL MCP Server starting...
GraphQL API Endpoint: https://countries.trevorblades.com
API Key: Not configured
Whitelist: Enabled (3 queries)
```

If a whitelist is enabled, any attempt to use a query not in the whitelist will be rejected with an error message.

## Recommendation

For simpler configuration:
- Use the comma-separated format (`countries,continent,languages`) in `.env` files
- Use the JSON array string format (`"[\"countries\",\"continent\",\"languages\"]"`) in JSON config files
