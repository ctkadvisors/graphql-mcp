# Lambda-MCP Implementation Plan

This document outlines the detailed implementation plan for Lambda-MCP, taking into account the patterns from [MCP2Lambda](https://github.com/danilop/MCP2Lambda) while addressing its security concerns.

## 1. Core Transport Library Development

### Week 1-2: Foundation Setup

#### Task 1.1: Project Initialization
- [ ] Set up TypeScript project structure
- [ ] Configure build tools (tsc, esbuild)
- [ ] Set up linting and code formatting
- [ ] Configure unit testing framework
- [ ] Create initial README and documentation

#### Task 1.2: MCP Protocol Implementation
- [ ] Implement JSON-RPC 2.0 message parsing
- [ ] Create MCP protocol message handlers
- [ ] Implement protocol negotiation
- [ ] Set up error handling
- [ ] Create logging utilities

#### Task 1.3: Lambda Transport Layer
- [ ] Implement AWS Lambda event handler
- [ ] Create API Gateway integration 
- [ ] Add authentication handling
- [ ] Implement response formatting
- [ ] Set up context propagation

#### Task 1.4: Server Base Class
- [ ] Create abstract server base class
- [ ] Implement tool registration pattern
- [ ] Add validation utilities
- [ ] Create Lambda handler factory
- [ ] Implement server lifecycle management

#### Task 1.5: Testing Framework
- [ ] Set up unit tests for core components
- [ ] Create test fixtures and mocks
- [ ] Implement integration test framework
- [ ] Add CI/CD pipeline configuration

## 2. Example Implementations

### Week 3-4: Hello World Example

#### Task 2.1: Hello World MCP Server
- [ ] Create simple greeting tool
- [ ] Implement input validation
- [ ] Add response formatting
- [ ] Create Lambda handler
- [ ] Write deployment configuration

#### Task 2.2: AWS CDK Deployment
- [ ] Create CDK stack for Hello World example
- [ ] Configure API Gateway integration
- [ ] Set up Lambda function
- [ ] Add security controls
- [ ] Implement monitoring and logging

#### Task 2.3: Documentation and Testing
- [ ] Create usage documentation
- [ ] Add configuration examples
- [ ] Implement end-to-end tests
- [ ] Create troubleshooting guide
- [ ] Document security considerations

### Week 5-6: GraphQL MCP Server

#### Task 3.1: GraphQL Server Core
- [ ] Implement GraphQL client integration
- [ ] Create query validation logic
- [ ] Add schema introspection support
- [ ] Implement input sanitization
- [ ] Create response formatting

#### Task 3.2: Configuration and Security
- [ ] Add GraphQL endpoint configuration
- [ ] Implement authentication for GraphQL API
- [ ] Create parameter validation schemas
- [ ] Add query depth/complexity limits
- [ ] Implement rate limiting

#### Task 3.3: Deployment and Documentation
- [ ] Create CDK stack for GraphQL MCP server
- [ ] Implement Lambda handler
- [ ] Configure API Gateway
- [ ] Write comprehensive documentation
- [ ] Create example prompts and usage patterns

### Week 7-8: Elasticsearch MCP Server

#### Task 4.1: Elasticsearch Core
- [ ] Implement Elasticsearch client integration
- [ ] Create query builder and validator
- [ ] Add result formatting
- [ ] Implement pagination support
- [ ] Add query templates

#### Task 4.2: Security and Validation
- [ ] Implement query sanitization
- [ ] Add index name validation
- [ ] Create security filters
- [ ] Implement access control
- [ ] Add query limiting

#### Task 4.3: Deployment and Documentation
- [ ] Create CDK stack for Elasticsearch MCP server
- [ ] Configure API Gateway with security rules
- [ ] Set up monitoring and alerting
- [ ] Write comprehensive documentation
- [ ] Create example use cases

## Detailed Implementation Guidelines

### GraphQL MCP Server Implementation

#### Server Definition
```typescript
import { createMCPLambdaHandler } from 'lambda-mcp';
import { GraphQLClient } from 'graphql-request';

// Create GraphQL client
const graphqlClient = new GraphQLClient(process.env.GRAPHQL_ENDPOINT || '', {
  headers: {
    Authorization: `Bearer ${process.env.GRAPHQL_API_KEY || ''}`,
  },
});

// Define GraphQL query tool
const graphqlQueryTool = {
  name: 'graphql_query',
  description: 'Execute a GraphQL query against the API',
  parameters: {
    query: {
      type: 'string',
      description: 'The GraphQL query to execute',
      required: true
    },
    variables: {
      type: 'object',
      description: 'Variables for the query',
      required: false
    }
  },
  handler: async ({ query, variables = {} }) => {
    // Validate query (implement security checks here)
    if (!isValidGraphQLQuery(query)) {
      throw new Error('Invalid GraphQL query');
    }

    // Execute query
    try {
      const result = await graphqlClient.request(query, variables);
      return result;
    } catch (error) {
      throw new Error(`GraphQL error: ${error.message}`);
    }
  }
};

// Define GraphQL schema tool
const graphqlSchemaQueryTool = {
  name: 'graphql_schema',
  description: 'Get information about the GraphQL schema',
  parameters: {
    type: 'string',
    description: 'Type name to get information about (optional)',
    required: false
  },
  handler: async ({ type = null }) => {
    // Implement introspection query
    const introspectionQuery = `{
      __schema {
        types {
          name
          description
          fields {
            name
            description
            type {
              name
              kind
            }
          }
        }
      }
    }`;
    
    try {
      const result = await graphqlClient.request(introspectionQuery);
      
      // Filter result if type is specified
      if (type) {
        const typeInfo = result.__schema.types.find(t => t.name === type);
        return typeInfo || { error: `Type '${type}' not found` };
      }
      
      // Return simplified schema overview
      return {
        types: result.__schema.types
          .filter(t => !t.name.startsWith('__'))
          .map(t => ({
            name: t.name,
            description: t.description,
            fieldCount: t.fields?.length || 0
          }))
      };
    } catch (error) {
      throw new Error(`Schema query error: ${error.message}`);
    }
  }
};

// Create Lambda handler
export const handler = createMCPLambdaHandler({
  name: 'graphql-mcp-server',
  version: '1.0.0',
  tools: [graphqlQueryTool, graphqlSchemaQueryTool]
});

// Helper functions
function isValidGraphQLQuery(query: string): boolean {
  // Implement validation logic
  // Check for prohibited operations, depth, etc.
  return true; // Placeholder
}
```

### Elasticsearch MCP Server Implementation

#### Server Definition
```typescript
import { createMCPLambdaHandler } from 'lambda-mcp';
import { Client } from '@elastic/elasticsearch';

// Create Elasticsearch client
const esClient = new Client({
  node: process.env.ES_ENDPOINT || '',
  auth: {
    apiKey: process.env.ES_API_KEY || '',
  },
});

// Define search tool
const esSearchTool = {
  name: 'es_search',
  description: 'Search Elasticsearch index',
  parameters: {
    index: {
      type: 'string',
      description: 'The index to search',
      required: true
    },
    query: {
      type: 'string', 
      description: 'The search query text',
      required: true
    },
    size: {
      type: 'number',
      description: 'Number of results to return',
      required: false
    },
    from: {
      type: 'number',
      description: 'Starting position for pagination',
      required: false
    }
  },
  handler: async ({ index, query, size = 10, from = 0 }) => {
    // Validate index name
    if (!isValidIndexName(index)) {
      throw new Error('Invalid index name');
    }
    
    // Build the query
    const searchQuery = {
      query: {
        query_string: {
          query: query
        }
      }
    };
    
    // Execute search
    try {
      const response = await esClient.search({
        index,
        body: searchQuery,
        size,
        from
      });
      
      // Format results
      return {
        hits: response.hits.hits.map(hit => ({
          id: hit._id,
          score: hit._score,
          source: hit._source
        })),
        total: response.hits.total.value,
        took: response.took,
        page: {
          size,
          from,
          more: response.hits.total.value > (from + size)
        }
      };
    } catch (error) {
      throw new Error(`Elasticsearch error: ${error.message}`);
    }
  }
};

// Define index list tool
const esListIndicesTools = {
  name: 'es_list_indices',
  description: 'List available Elasticsearch indices',
  parameters: {
    pattern: {
      type: 'string',
      description: 'Index name pattern to filter results',
      required: false
    }
  },
  handler: async ({ pattern = '*' }) => {
    try {
      const response = await esClient.cat.indices({ 
        format: 'json',
        index: pattern 
      });
      
      // Filter and format results for allowed indices
      return response.body
        .filter(index => isAllowedIndex(index.index))
        .map(index => ({
          name: index.index,
          docs: parseInt(index['docs.count']),
          size: index['store.size']
        }));
    } catch (error) {
      throw new Error(`Index listing error: ${error.message}`);
    }
  }
};

// Create Lambda handler
export const handler = createMCPLambdaHandler({
  name: 'elasticsearch-mcp-server',
  version: '1.0.0',
  tools: [esSearchTool, esListIndicesTools]
});

// Helper functions
function isValidIndexName(index: string): boolean {
  // Check if index name is valid and allowed
  const validPattern = /^[a-z0-9_\-\.]+$/;
  return validPattern.test(index) && isAllowedIndex(index);
}

function isAllowedIndex(index: string): boolean {
  // Implement access control logic
  const allowedIndices = process.env.ALLOWED_INDICES?.split(',') || [];
  return allowedIndices.length === 0 || allowedIndices.includes(index);
}
```

## CDK Deployment

### GraphQL MCP Server Stack
```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class GraphQLMCPServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // API key for MCP server access
    const mcpApiKey = new secretsmanager.Secret(this, 'MCPApiKey', {
      description: 'API key for GraphQL MCP server',
      generateSecretString: {
        passwordLength: 32,
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
      },
    });
    
    // GraphQL API key (stored in Secrets Manager)
    const graphqlApiKey = secretsmanager.Secret.fromSecretNameV2(
      this, 
      'GraphQLApiKey',
      'graphql/api-key'
    );
    
    // Lambda function for MCP server
    const mcpFunction = new lambda.Function(this, 'GraphQLMCPFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../dist'),
      environment: {
        GRAPHQL_ENDPOINT: 'https://your-graphql-api.example.com/graphql',
        GRAPHQL_API_KEY: graphqlApiKey.secretValue.toString(),
        MCP_API_KEY: mcpApiKey.secretValue.toString()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });
    
    // API Gateway
    const api = new apigateway.RestApi(this, 'GraphQLMCPApi', {
      description: 'API Gateway for GraphQL MCP Server',
      deployOptions: {
        stageName: 'prod',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });
    
    // API key authentication
    const plan = api.addUsagePlan('MCPUsagePlan', {
      name: 'MCP Usage Plan',
      throttle: {
        rateLimit: 10,
        burstLimit: 20,
      },
    });
    
    const apiKey = api.addApiKey('MCPApiKey');
    plan.addApiKey(apiKey);
    
    // Lambda integration
    const mcpIntegration = new apigateway.LambdaIntegration(mcpFunction);
    const mcpResource = api.root.addResource('mcp');
    mcpResource.addMethod('POST', mcpIntegration, {
      apiKeyRequired: true,
    });
    
    // Output API endpoint
    new cdk.CfnOutput(this, 'MCPApiEndpoint', {
      value: `${api.url}mcp`,
      description: 'Endpoint URL for MCP server',
    });
  }
}
```

### Elasticsearch MCP Server Stack
```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class ElasticsearchMCPServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // API key for MCP server access
    const mcpApiKey = new secretsmanager.Secret(this, 'MCPApiKey', {
      description: 'API key for Elasticsearch MCP server',
      generateSecretString: {
        passwordLength: 32,
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
      },
    });
    
    // Elasticsearch API key (stored in Secrets Manager)
    const esApiKey = secretsmanager.Secret.fromSecretNameV2(
      this, 
      'ESApiKey',
      'elasticsearch/api-key'
    );
    
    // Lambda function for MCP server
    const mcpFunction = new lambda.Function(this, 'ElasticsearchMCPFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../dist'),
      environment: {
        ES_ENDPOINT: 'https://your-elasticsearch.example.com',
        ES_API_KEY: esApiKey.secretValue.toString(),
        ALLOWED_INDICES: 'products,customers,content',
        MCP_API_KEY: mcpApiKey.secretValue.toString()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });
    
    // API Gateway
    const api = new apigateway.RestApi(this, 'ElasticsearchMCPApi', {
      description: 'API Gateway for Elasticsearch MCP Server',
      deployOptions: {
        stageName: 'prod',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });
    
    // API key authentication
    const plan = api.addUsagePlan('MCPUsagePlan', {
      name: 'MCP Usage Plan',
      throttle: {
        rateLimit: 10,
        burstLimit: 20,
      },
    });
    
    const apiKey = api.addApiKey('MCPApiKey');
    plan.addApiKey(apiKey);
    
    // Lambda integration
    const mcpIntegration = new apigateway.LambdaIntegration(mcpFunction);
    const mcpResource = api.root.addResource('mcp');
    mcpResource.addMethod('POST', mcpIntegration, {
      apiKeyRequired: true,
    });
    
    // Output API endpoint
    new cdk.CfnOutput(this, 'MCPApiEndpoint', {
      value: `${api.url}mcp`,
      description: 'Endpoint URL for MCP server',
    });
  }
}
```

## Testing Plan

1. **Unit Testing**:
   - Test MCP message parsing
   - Test Lambda handler processing
   - Test tool execution
   - Test error handling

2. **Integration Testing**:
   - Test with mock MCP client
   - Test GraphQL queries
   - Test Elasticsearch searches
   - Test error scenarios

3. **End-to-End Testing**:
   - Test with Claude Desktop
   - Test with other MCP clients
   - Test deployment via CDK
   - Test security controls

4. **Security Testing**:
   - Test authentication
   - Test input validation
   - Test for prompt injection vulnerabilities
   - Test rate limiting and throttling
