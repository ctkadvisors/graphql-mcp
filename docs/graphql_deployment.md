# GraphQL MCP Server Deployment Guide

This guide explains how to deploy the GraphQL MCP server to AWS using the AWS CDK.

## Prerequisites

Before deploying the GraphQL MCP server, ensure you have the following:

1. AWS CLI installed and configured with appropriate credentials
2. Node.js 18.x or later
3. AWS CDK installed globally (`npm install -g aws-cdk`)
4. A GraphQL API endpoint that you want to connect to (optional)

## Configuration

The GraphQL MCP server can be configured using environment variables:

- `GRAPHQL_API_ENDPOINT`: (Optional) The default GraphQL API endpoint to connect to
- `GRAPHQL_API_KEY`: (Optional) API key for the GraphQL API endpoint

You can set these environment variables before deployment, or you can specify them directly in the CDK stack.

## Deployment Steps

### 1. Build the Project

First, build the TypeScript project:

```bash
npm run build
```

### 2. Deploy the CDK Stack

Deploy the GraphQL MCP server using the CDK:

```bash
npm run deploy:graphql
```

Or with environment variables:

```bash
GRAPHQL_API_ENDPOINT=https://your-graphql-api.com/graphql GRAPHQL_API_KEY=your-api-key npm run deploy:graphql
```

### 3. Note the API Endpoint

After deployment, the CDK will output the API Gateway endpoint URL for your GraphQL MCP server. Make note of this URL as you'll need it to connect to your MCP server.

## Using the GraphQL MCP Server

The GraphQL MCP server provides two main tools:

### 1. Execute Query Tool

This tool allows you to execute GraphQL queries against a GraphQL endpoint.

Example JSON-RPC request:

```json
{
  "jsonrpc": "2.0",
  "method": "tool.call",
  "params": {
    "name": "execute_query",
    "arguments": {
      "endpoint": "https://your-graphql-api.com/graphql",
      "query": "query { products { id name price } }",
      "variables": {},
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  },
  "id": 1
}
```

### 2. Introspect Schema Tool

This tool allows you to retrieve and analyze the GraphQL schema from a GraphQL endpoint.

Example JSON-RPC request:

```json
{
  "jsonrpc": "2.0",
  "method": "tool.call",
  "params": {
    "name": "introspect_schema",
    "arguments": {
      "endpoint": "https://your-graphql-api.com/graphql",
      "headers": {
        "Authorization": "Bearer your-token"
      },
      "force_refresh": false
    }
  },
  "id": 2
}
```

## Security Considerations

- The GraphQL MCP server does not implement authentication by default. Consider adding API Gateway authorizers if you need to restrict access.
- Be careful about exposing sensitive GraphQL endpoints through the MCP server. Consider implementing additional validation and access controls.
- The GraphQL MCP server will pass through any headers provided in the request, which could include authentication tokens. Ensure your API Gateway is configured with HTTPS to encrypt this traffic.

## Monitoring and Troubleshooting

- The CDK stack configures CloudWatch logging for the Lambda function and API Gateway.
- You can view logs in the AWS CloudWatch console.
- API Gateway metrics are enabled to help monitor request rates, latencies, and errors.

## Customization

To customize the GraphQL MCP server:

1. Modify the `src/examples/graphql/index.ts` file to add or modify tools.
2. Update the `infra/graphql-stack.ts` file to change the infrastructure configuration.
3. Rebuild and redeploy the stack.

## Local Development

For local development and testing:

```bash
npm run dev:graphql:ts
```

This will start a local server at http://localhost:3001 with the GraphQL MCP endpoint at http://localhost:3001/mcp/graphql.
