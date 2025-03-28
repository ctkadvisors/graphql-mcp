# GraphQL MCP Server

A strongly-typed TypeScript Model Context Protocol (MCP) server that provides seamless access to any GraphQL API through Claude AI.

## Features

- **Strongly Typed**: Built with TypeScript for improved code quality and type safety
- **Dynamic GraphQL Integration**: Connect to any GraphQL API with automatic tool generation
- **Schema Introspection**: Automatically discovers and exposes all GraphQL operations as tools
- **Full Mutation Support**: First-class support for GraphQL mutations with proper handling
- **Query & Mutation Whitelisting**: Optional whitelisting to control which GraphQL operations are exposed
- **Rich Type Support**: Properly handles complex GraphQL types, input objects, and variables
- **MCP Standard Compliant**: Follows the Model Context Protocol format for seamless Claude integration
- **Smart Query Generation**: Builds efficient GraphQL queries with proper field selection
- **Authentication Support**: Simple API key authentication

## Repository Structure

```
graphql-mcp/
├── src/
│   └── graphql-mcp-server.ts     # Main server implementation (TypeScript)
├── dist/                         # Compiled JavaScript (generated)
├── docs/
│   ├── GETTING_STARTED.md         # Setup and usage guide
│   ├── PROJECT_STATUS.md          # Current project status
│   └── TECHNICAL.md               # Technical documentation
├── .env.development               # Environment variables
├── .env.sample                    # Sample environment template
├── claude_desktop_sample_config.json  # Sample Claude Desktop config
├── package.json                   # Project dependencies
├── tsconfig.json                  # TypeScript configuration
├── run-graphql-mcp.sh             # Script to run the server
└── README.md                      # This file
```

## Prerequisites

- Node.js 18 or later
- TypeScript 5.x or later
- Claude Desktop with MCP support
- A GraphQL API endpoint (defaults to the Countries API if not specified)

## Installation

### Option 1: From npm

```bash
# Install globally
npm install -g graphql-mcp

# Run the server
graphql-mcp-server
```

### Option 2: Clone Repository

```bash
# Clone the repository
git clone https://github.com/ctkadvisors/graphql-mcp.git
cd graphql-mcp

# Install dependencies
npm install

# Run the server
npm start
```

## Quick Start

### 1. Setup Environment Variables

Copy the sample env file and update it with your GraphQL API details:

```bash
cp .env.sample .env.development
```

Edit `.env.development` with your GraphQL API endpoint and optional API key.

### 2. Build and Run

First compile the TypeScript code:

```bash
npm install
npm run build
```

Then run the server:

```bash
node dist/graphql-mcp-server.js
```

Or use the provided script that compiles and runs in one step:

```bash
./run-graphql-mcp.sh
```

### 3. Claude Desktop Integration

Add this server to your Claude Desktop configuration:

1. Use the sample config as a template:
   ```bash
   cp claude_desktop_sample_config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. Edit the config and update the path to point to your installation:
   ```json
   {
     "mcpServers": {
       "graphql": {
         "command": "node",
         "args": ["/absolute/path/to/dist/graphql-mcp-server.js"],
         "env": {
           "GRAPHQL_API_ENDPOINT": "https://your-graphql-api.com/graphql",
           "GRAPHQL_API_KEY": "your-api-key-if-needed",
           "WHITELISTED_QUERIES": "[\"countries\",\"continent\",\"languages\"]"
         }
       }
     }
   }
   ```

3. Restart Claude Desktop to connect to the server

You should now see GraphQL operations as available tools in Claude Desktop!

### Operation Whitelisting

For security or performance reasons, you may want to limit which GraphQL operations (queries and mutations) are exposed to Claude. There are two approaches to controlling access:

1. **Enable/Disable Mutations**: By default, all mutations are disabled for security. To enable mutations:

```json
"env": {
  "GRAPHQL_API_ENDPOINT": "https://example-graphql-api.com/graphql",
  "ENABLE_MUTATIONS": "true"
}
```

2. **Operation Whitelisting**: You can specify which specific operations should be available:

```json
"env": {
  "GRAPHQL_API_ENDPOINT": "https://example-graphql-api.com/graphql",
  "ENABLE_MUTATIONS": "true",
  "WHITELISTED_QUERIES": "[\"countries\",\"continent\",\"languages\"]",
  "WHITELISTED_MUTATIONS": "[\"createUser\",\"updateProfile\"]"
}
```

The whitelists can be specified in two formats:
- As a JSON array string (shown above): `"[\"query1\",\"query2\"]"` 
- As a comma-separated list: `"query1,query2,query3"`

> **IMPORTANT**: The whitelist values must be strings, not actual JSON array objects. Environment variables are always passed as strings, so you need to properly escape the quotes in the JSON string as shown above.

**Example of correct format in Claude Desktop configuration**:

```json
"graphql-api": {
  "command": "node",
  "args": [
    "/Users/username/Projects/graphql-mcp/dist/graphql-mcp-server.js"
  ],
  "env": {
    "GRAPHQL_API_ENDPOINT": "https://example-graphql-api.com/graphql",
    "NODE_ENV": "development",
    "DEBUG": "true",
    "ENABLE_MUTATIONS": "true",
    "WHITELISTED_QUERIES": "[\"getUser\",\"getProducts\",\"getOrders\"]",
    "WHITELISTED_MUTATIONS": "[\"createOrder\",\"updateProfile\"]"
  }
}
```

**Common mistake to avoid**:
```json
// INCORRECT - Will not work!
"WHITELISTED_QUERIES": ["getUser", "getProducts"],
"WHITELISTED_MUTATIONS": ["createOrder", "updateProfile"]

// CORRECT
"WHITELISTED_QUERIES": "[\"getUser\",\"getProducts\"]",
"WHITELISTED_MUTATIONS": "[\"createOrder\",\"updateProfile\"]"
```

If no whitelist is provided for a particular operation type, all operations of that type from the GraphQL schema will be available.

## Example Usage

### Querying Data

Once connected to Claude Desktop, you can use commands like:

```
View result from countries from graphql (local){}
```

Or with parameters:

```
View result from country from graphql (local){
  "code": "US"
}
```

### Using Mutations

For mutations, the tools are prefixed with `mutation_` to distinguish them from queries:

```
View result from mutation_createUser from graphql (local){
  "name": "John Doe",
  "email": "john.doe@example.com"
}
```

Or a more complex mutation:

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

Mutations follow the same pattern as queries but allow you to modify data in your GraphQL API.

## Documentation

For more detailed information, see:

- [Getting Started Guide](./docs/GETTING_STARTED.md)
- [Technical Documentation](./docs/TECHNICAL.md)
- [Query Whitelist Documentation](./docs/QUERY_WHITELIST.md)
- [Mutations Documentation](./docs/MUTATIONS.md)
- [Project Status](./docs/PROJECT_STATUS.md)

## Development

To make changes to the server:

1. Modify the TypeScript source in `src/graphql-mcp-server.ts`
2. Compile the TypeScript code: `npm run build`
3. Run the compiled server: `node dist/graphql-mcp-server.js`

## Publishing to npm

To publish this package to npm:

```bash
# Make sure you're logged in to npm
npm login

# Build the project
npm run build

# Publish to npm
npm publish
```

The package will include the pre-built JavaScript files in the `dist` directory, making it ready to use without additional build steps.

## License

This project is licensed under the Business Source License 1.1 (BSL 1.1), which allows:

- **Non-commercial use**: You may use this software for any non-commercial purpose
- **Internal business use**: You may use this software for internal business operations that do not provide it to third parties as a hosted or managed service
- **Open source conversion**: On March 14, 2029, the code will automatically convert to the MIT license

Commercial use, including offering this software as a service to others, requires a commercial license from CTK Advisors. For more information, contact us or see the full [LICENSE](./LICENSE) file.

The BSL license is designed to balance open source availability with sustainable commercial development, giving everyone free access for non-commercial purposes while protecting our ability to support and enhance the software long-term.
