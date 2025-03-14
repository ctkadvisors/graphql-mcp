# GraphQL MCP Server - Technical Documentation

## Architecture Overview

The GraphQL MCP server is a TypeScript application that acts as a bridge between Claude AI and any GraphQL API. It dynamically generates MCP tools by introspecting the GraphQL schema and provides a standardized interface for Claude to execute GraphQL operations.

## Key Components

### 1. TypeScript Type System

- **Strong Typing**: Comprehensive TypeScript interfaces for all components
- **Type Safety**: Ensures type correctness across the codebase
- **Error Handling**: Improved error detection and handling with proper type checking

### 2. Schema Introspection and Caching

- **Introspection Query**: Uses GraphQL's standard introspection query to discover all available operations
- **Schema Caching**: Caches the schema to avoid repeated introspection calls (default TTL: 1 hour)
- **Type Analysis**: Analyzes GraphQL types to determine proper JSON Schema representations

### 3. Dynamic Tool Generation

- **Tool Creation**: Generates MCP tools for each query operation in the GraphQL schema
- **Input Schema Mapping**: Maps GraphQL input types to JSON Schema for proper validation
- **Description Extraction**: Uses GraphQL descriptions for tool and parameter documentation

### 4. Query Execution

- **Variable Processing**: Converts input arguments to proper GraphQL variables
- **Smart Selection Sets**: Builds field selection sets that fetch appropriate data without overfetching
- **Depth Control**: Limits recursion depth to avoid n+1 query problems and excessive nesting

### 5. MCP Protocol Support

- **Protocol Compliance**: Implements the Model Context Protocol (2024-11-05)
- **Response Formatting**: Formats GraphQL responses according to MCP standards
- **Error Handling**: Properly propagates and formats GraphQL errors for Claude

## Type Definitions

### GraphQL Type Mapping

| GraphQL Type                  | TypeScript Type                |
|-------------------------------|---------------------------------|
| GraphQLSchema                 | GraphQLSchema                  |
| GraphQLObjectType             | GraphQLObjectType              |
| GraphQLScalarType             | GraphQLScalarType              |
| GraphQLEnumType               | GraphQLEnumType                |
| GraphQLInputObjectType        | GraphQLInputObjectType         |
| GraphQLNonNull<T>             | GraphQLNonNull<T>              |
| GraphQLList<T>                | GraphQLList<T>                 |

### Key Interface Definitions

#### MCP Tool Definition
```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}
```

#### JSON-RPC Request/Response
```typescript
interface JSONRPCRequest {
  jsonrpc: string;
  id: number | string | null;
  method: string;
  params?: any;
}

interface JSONRPCResponse {
  jsonrpc: string;
  id: number | string | null;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}
```

#### Query Execution Arguments
```typescript
interface QueryExecutionArgs {
  query: string;
  variables?: Record<string, any>;
  endpoint?: string;
  headers?: Record<string, string>;
}
```

## Error Handling

The server implements comprehensive error handling with TypeScript's help:

- **Type Guards**: Uses `instanceof Error` checks to properly handle errors
- **Error Propagation**: Errors are properly typed and propagated
- **Meaningful Messages**: Error messages include context about where they occurred

## Performance Considerations

- **Schema Caching**: Reduces load on the GraphQL API
- **Controlled Recursion**: Prevents excessive depth in queries
- **Selective Field Fetching**: Only requests necessary fields
- **Query Batching**: Groups related fields to minimize round-trips

## Security

- **Authentication**: Supports Bearer token authentication
- **Error Sanitization**: Ensures sensitive information isn't exposed in error messages
- **Input Validation**: Validates all inputs before executing queries
- **Type Checking**: TypeScript adds an additional layer of security by ensuring type correctness

## Configuration Options

| Environment Variable    | Description                           | Default                                  |
|-------------------------|---------------------------------------|------------------------------------------|
| GRAPHQL_API_ENDPOINT    | URL of the GraphQL API                | https://countries.trevorblades.com/graphql |
| GRAPHQL_API_KEY         | API key for authentication            | (empty)                                  |
| DEBUG                   | Enable detailed debug logging         | false                                    |

## Advanced Usage

### Custom Headers

To add custom headers to GraphQL requests, you can modify the server code:

```typescript
const headers: Record<string, string> = { 
  ...args.headers,
  'X-Custom-Header': 'value'
};
```

### Adding Authorization

For APIs requiring complex authorization, modify the headers setup:

```typescript
if (GRAPHQL_API_KEY) {
  // Change from Bearer to the appropriate auth method
  headers.Authorization = `ApiKey ${GRAPHQL_API_KEY}`;
}
```

### Limiting Available Operations

To restrict which operations are exposed as tools, add filtering logic to the `getToolsFromSchema` function:

```typescript
// Only allow specific operations
if (!['countries', 'country', 'continents'].includes(fieldName)) {
  continue;
}
```

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run development server with hot-reload
npm run dev:watch
```

### TypeScript Configuration

The project uses a standard TypeScript configuration:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": true,
    "...": "..."
  }
}
```
