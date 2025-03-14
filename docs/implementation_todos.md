# Lambda-MCP Implementation TODOs

This document outlines the specific implementation tasks for developing the Lambda-MCP transport layer - a lightweight, reusable foundation for building MCP-compliant servers on AWS Lambda.

## Core Lambda-MCP Transport Implementation

### 1. Project Setup

- [ ] **Initialize Base Project**
  ```bash
  mkdir -p lambda-mcp/src/{transport,types,utils}
  cd lambda-mcp
  npm init -y
  npm install typescript @types/node esbuild
  npx tsc --init
  ```

- [ ] **Configure Basic Package Structure**
  - Create a package structure that allows for publishing to npm
  - Set up a build process that outputs both CommonJS and ESM modules
  - Configure TypeScript for type generation

### 2. MCP Transport Layer

- [ ] **Implement Base Transport Interface**
  ```typescript
  // src/transport/transport-interface.ts
  export interface MCPTransportOptions {
    authenticationHandler?: (request: any) => Promise<boolean>;
    errorHandler?: (error: Error, context: any) => void;
    // Other configuration options
  }

  export interface MCPTransport {
    initialize(): Promise<void>;
    handleRequest(request: any): Promise<any>;
    send(response: any): Promise<void>;
    close(): Promise<void>;
  }
  ```

- [ ] **Create Lambda HTTP Transport Implementation**
  ```typescript
  // src/transport/lambda-transport.ts
  import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
  import { MCPTransport, MCPTransportOptions } from './transport-interface';
  
  export class LambdaMCPTransport implements MCPTransport {
    constructor(private options: MCPTransportOptions = {}) {}
    
    async initialize(): Promise<void> {
      // Initialize transport-specific resources
    }
    
    async handleRequest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
      try {
        // Authentication check if configured
        if (this.options.authenticationHandler) {
          const isAuthenticated = await this.options.authenticationHandler(event);
          if (!isAuthenticated) {
            return {
              statusCode: 401,
              body: JSON.stringify({ error: 'Unauthorized' })
            };
          }
        }
        
        // Parse and process the MCP message
        const body = JSON.parse(event.body || '{}');
        // Process according to MCP protocol...
        
        return {
          statusCode: 200,
          body: JSON.stringify({ /* MCP response */ })
        };
      } catch (error) {
        // Handle errors
        if (this.options.errorHandler) {
          this.options.errorHandler(error as Error, event);
        }
        
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal server error' })
        };
      }
    }
    
    async send(response: any): Promise<void> {
      // Implementation for Lambda is handled by return value of handleRequest
    }
    
    async close(): Promise<void> {
      // Clean up any resources
    }
  }
  ```

### 3. MCP Protocol Implementation

- [ ] **Define Core Protocol Types**
  ```typescript
  // src/types/mcp-types.ts
  export interface MCPRequest {
    id?: string;
    method: string;
    params?: any;
  }
  
  export interface MCPResponse {
    id?: string;
    result?: any;
    error?: MCPError;
  }
  
  export interface MCPError {
    code: number;
    message: string;
    data?: any;
  }
  
  export interface MCPToolDefinition {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  }
  ```

- [ ] **Implement Message Processing**
  ```typescript
  // src/transport/message-processor.ts
  import { MCPRequest, MCPResponse, MCPError } from '../types/mcp-types';
  
  export class MCPMessageProcessor {
    processRequest(request: MCPRequest): Promise<MCPResponse> {
      // Process the request according to MCP protocol
      // Handle initialization, tool calls, etc.
    }
    
    createErrorResponse(id: string | undefined, code: number, message: string): MCPResponse {
      return {
        id,
        error: {
          code,
          message
        }
      };
    }
  }
  ```

### 4. Create Base MCP Server Class

- [ ] **Implement Reusable Server Base**
  ```typescript
  // src/server.ts
  import { MCPTransport } from './transport/transport-interface';
  import { MCPMessageProcessor } from './transport/message-processor';
  import { MCPToolDefinition } from './types/mcp-types';
  
  export interface MCPServerOptions {
    name: string;
    version: string;
    tools?: MCPToolDefinition[];
    // Additional configuration
  }
  
  export class MCPServer {
    private processor: MCPMessageProcessor;
    private tools: Map<string, any> = new Map();
    
    constructor(
      private transport: MCPTransport,
      private options: MCPServerOptions
    ) {
      this.processor = new MCPMessageProcessor();
      
      // Register tools if provided
      if (options.tools) {
        options.tools.forEach(tool => {
          this.registerTool(tool.name, tool);
        });
      }
    }
    
    registerTool(name: string, implementation: any): void {
      this.tools.set(name, implementation);
    }
    
    async start(): Promise<void> {
      await this.transport.initialize();
      // Additional initialization as needed
    }
    
    async handleRequest(request: any): Promise<any> {
      return await this.transport.handleRequest(request);
    }
    
    async stop(): Promise<void> {
      await this.transport.close();
    }
  }
  ```

### 5. Create Lambda Handler

- [ ] **Implement Lambda Entry Point**
  ```typescript
  // src/lambda-handler.ts
  import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
  import { LambdaMCPTransport } from './transport/lambda-transport';
  import { MCPServer } from './server';
  
  // This factory function creates a reusable Lambda handler
  export function createMCPLambdaHandler(serverOptions: any) {
    const transport = new LambdaMCPTransport();
    const server = new MCPServer(transport, serverOptions);
    
    // Initialize the server
    let initialized = false;
    const initialize = async () => {
      if (!initialized) {
        await server.start();
        initialized = true;
      }
    };
    
    // Return the Lambda handler function
    return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      await initialize();
      return await server.handleRequest(event);
    };
  }
  ```

## Example Implementation - "Hello World" MCP Server

- [ ] **Create Simple Example**
  ```typescript
  // examples/hello-world/index.ts
  import { createMCPLambdaHandler } from 'lambda-mcp';
  
  // Define a simple hello world tool
  const helloWorldTool = {
    name: 'hello_world',
    description: 'A simple greeting tool',
    parameters: {
      name: {
        type: 'string',
        description: 'The name to greet'
      }
    },
    handler: async (params: { name: string }) => {
      return `Hello, ${params.name || 'World'}!`;
    }
  };
  
  // Create the Lambda handler
  export const handler = createMCPLambdaHandler({
    name: 'hello-world-mcp',
    version: '1.0.0',
    tools: [helloWorldTool]
  });
  ```

## Infrastructure as Code

- [ ] **Create CDK Example for Deployment**
  ```typescript
  // examples/hello-world/infra/cdk-stack.ts
  import * as cdk from 'aws-cdk-lib';
  import * as lambda from 'aws-cdk-lib/aws-lambda';
  import * as apigateway from 'aws-cdk-lib/aws-apigateway';
  import { Construct } from 'constructs';
  
  export class HelloWorldMCPStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
      super(scope, id, props);
      
      // Lambda function
      const mcpFunction = new lambda.Function(this, 'HelloWorldMCPFunction', {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset('../dist'),
      });
      
      // API Gateway
      const api = new apigateway.RestApi(this, 'HelloWorldMCPApi', {
        description: 'API Gateway for Hello World MCP Server',
        deployOptions: {
          stageName: 'prod',
        },
      });
      
      // Add Lambda integration
      const mcpIntegration = new apigateway.LambdaIntegration(mcpFunction);
      api.root.addMethod('POST', mcpIntegration);
    }
  }
  ```

## Documentation

- [ ] **Create Basic Documentation**
  - Installation and usage guide
  - API reference for the lambda-mcp library
  - Examples of creating custom MCP servers
  - Deployment instructions

## Testing

- [ ] **Unit Tests for Core Components**
  - Test MCP message processing
  - Test Lambda transport handling
  - Test error scenarios
  
- [ ] **Integration Test with Claude Desktop**
  - Create test script for connecting Claude Desktop to the MCP server
  - Verify end-to-end functionality

## Next Steps 

After completing the basic transport layer and "Hello World" example:

1. Implement the GraphQL tool as a standalone MCP server using lambda-mcp
2. Implement the Elasticsearch tool as another standalone MCP server
3. Document patterns for creating custom tool-specific MCP servers
4. Optimize for performance and scalability

This focused approach will result in a lightweight, reusable library that simplifies building MCP-compliant servers on AWS Lambda, with each server dedicated to a specific API/service integration.
