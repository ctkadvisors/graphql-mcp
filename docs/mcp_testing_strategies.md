# MCP Testing Strategies for Lambda-MCP

This document outlines comprehensive testing strategies for Lambda-MCP servers to ensure they correctly implement the Model Context Protocol (MCP) specification and provide reliable tool functionality.

## 1. Protocol Compliance Testing

### 1.1 Initialization Sequence Testing

Test proper handling of the MCP initialization sequence:

```javascript
// Test proper initialization
async function testInitialization() {
  // 1. Initialize request
  const initResult = await sendRequest({
    jsonrpc: "2.0",
    id: "init-1",
    method: "initialize",
    params: {
      client: {
        name: "Test Client",
        version: "1.0.0"
      },
      capabilities: {}
    }
  });
  
  // 2. Verify server info and capabilities
  assert(initResult.result.server.name);
  assert(initResult.result.server.version);
  
  // 3. Send initialized notification
  await sendRequest({
    jsonrpc: "2.0",
    method: "initialized",
    params: {}
  });
  
  // 4. Verify method calls work after initialization
  const toolListResult = await sendRequest({
    jsonrpc: "2.0",
    id: "list-1",
    method: "tool.list",
    params: {}
  });
  
  assert(toolListResult.result.tools);
}
```

### 1.2 Error Handling Testing

Test proper implementation of JSON-RPC error responses:

```javascript
async function testErrorHandling() {
  // Test method not found
  const unknownMethodResult = await sendRequest({
    jsonrpc: "2.0",
    id: "err-1",
    method: "unknown_method",
    params: {}
  });
  
  assert(unknownMethodResult.error);
  assert.equal(unknownMethodResult.error.code, -32601); // Method not found
  
  // Test invalid parameters
  const invalidParamsResult = await sendRequest({
    jsonrpc: "2.0",
    id: "err-2",
    method: "tool.call",
    params: {
      // Missing required id field
      name: "hello_world",
      arguments: {}
    }
  });
  
  assert(invalidParamsResult.error);
  assert.equal(invalidParamsResult.error.code, -32602); // Invalid params
}
```

### 1.3 Protocol Edge Cases

Test handling of edge cases in the protocol:

```javascript
async function testProtocolEdgeCases() {
  // Test notification handling (no id)
  const notificationResult = await sendRequest({
    jsonrpc: "2.0",
    method: "custom_notification",
    params: {}
  });
  
  // Should receive empty response or no response
  assert(!notificationResult || Object.keys(notificationResult).length === 0);
  
  // Test batch requests (if supported)
  const batchResult = await sendRequest([
    {
      jsonrpc: "2.0",
      id: "batch-1",
      method: "tool.list",
      params: {}
    },
    {
      jsonrpc: "2.0",
      id: "batch-2",
      method: "tool.call",
      params: {
        id: "call-1",
        name: "hello_world",
        arguments: { name: "Test" }
      }
    }
  ]);
  
  // Check if batch is supported or gracefully rejected
  if (Array.isArray(batchResult)) {
    assert.equal(batchResult.length, 2);
  } else {
    assert(batchResult.error);
  }
}
```

## 2. Tool Implementation Testing

### 2.1 Tool Discovery Testing

Test the tool discovery functionality:

```javascript
async function testToolDiscovery() {
  const toolListResult = await sendRequest({
    jsonrpc: "2.0",
    id: "list-1",
    method: "tool.list",
    params: {}
  });
  
  assert(toolListResult.result.tools);
  assert(Array.isArray(toolListResult.result.tools));
  
  // Verify tool definitions are complete
  for (const tool of toolListResult.result.tools) {
    assert(tool.name);
    assert(tool.description);
    assert(tool.parameters);
    
    // Check parameter definitions
    for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
      assert(paramDef.type);
      assert(paramDef.description);
    }
  }
}
```

### 2.2 Tool Execution Testing

Test tool execution with valid parameters:

```javascript
async function testToolExecution() {
  // Get tool list first
  const toolListResult = await sendRequest({
    jsonrpc: "2.0",
    id: "list-1",
    method: "tool.list",
    params: {}
  });
  
  // For each tool, test with valid parameters
  for (const tool of toolListResult.result.tools) {
    // Create valid arguments based on parameter definitions
    const args = {};
    for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
      if (paramDef.required) {
        // Generate valid value based on type
        args[paramName] = generateValidValue(paramDef);
      }
    }
    
    // Call the tool
    const toolCallResult = await sendRequest({
      jsonrpc: "2.0",
      id: `call-${tool.name}`,
      method: "tool.call",
      params: {
        id: `tool-call-${tool.name}`,
        name: tool.name,
        arguments: args
      }
    });
    
    // Verify successful response
    assert(toolCallResult.result);
    assert(!toolCallResult.error);
  }
}

// Helper to generate valid values for parameter types
function generateValidValue(paramDef) {
  switch (paramDef.type) {
    case 'string':
      return paramDef.enum ? paramDef.enum[0] : 'test-string';
    case 'number':
      return paramDef.default ?? 42;
    case 'boolean':
      return true;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}
```

### 2.3 Parameter Validation Testing

Test parameter validation for tools:

```javascript
async function testParameterValidation() {
  // Test required parameter validation
  const missingRequiredResult = await sendRequest({
    jsonrpc: "2.0",
    id: "val-1",
    method: "tool.call",
    params: {
      id: "call-1",
      name: "echo", // Echo tool requires a 'message' parameter
      arguments: {}
    }
  });
  
  assert(missingRequiredResult.result.error || missingRequiredResult.error);
  
  // Test type validation
  const wrongTypeResult = await sendRequest({
    jsonrpc: "2.0",
    id: "val-2",
    method: "tool.call",
    params: {
      id: "call-2",
      name: "echo",
      arguments: {
        message: 123 // Should be a string
      }
    }
  });
  
  assert(wrongTypeResult.result.error || wrongTypeResult.error);
  
  // Test enum validation
  const invalidEnumResult = await sendRequest({
    jsonrpc: "2.0",
    id: "val-3",
    method: "tool.call",
    params: {
      id: "call-3",
      name: "hello_world",
      arguments: {
        language: "invalid-language" // Not in allowed languages
      }
    }
  });
  
  assert(invalidEnumResult.result.error || invalidEnumResult.error);
}
```

## 3. Transport Layer Testing

### 3.1 HTTP Transport Testing

Test the HTTP transport handling:

```javascript
async function testHTTPTransport() {
  // Test content type handling
  const contentTypeResult = await fetch('/mcp/hello-world', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "http-1",
      method: "tool.list",
      params: {}
    })
  });
  
  assert.equal(contentTypeResult.headers.get('Content-Type'), 'application/json');
  
  // Test CORS headers
  const corsResult = await fetch('/mcp/hello-world', {
    method: 'OPTIONS'
  });
  
  assert(corsResult.headers.get('Access-Control-Allow-Origin'));
  assert(corsResult.headers.get('Access-Control-Allow-Methods'));
  
  // Test large payload handling
  const largePayload = {
    jsonrpc: "2.0",
    id: "http-2",
    method: "tool.call",
    params: {
      id: "call-1",
      name: "echo",
      arguments: {
        message: "a".repeat(1024 * 1024) // 1MB message
      }
    }
  };
  
  const largePayloadResult = await fetch('/mcp/hello-world', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(largePayload)
  });
  
  // Either handles it or rejects with appropriate error
  assert(largePayloadResult.status === 200 || largePayloadResult.status === 413);
}
```

### 3.2 Error Handling Testing

Test error handling in the transport layer:

```javascript
async function testTransportErrors() {
  // Test invalid JSON
  const invalidJsonResult = await fetch('/mcp/hello-world', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: '{"jsonrpc": "2.0", "id": "invalid-1", "method": "tool.list", params: {}' // Invalid JSON
  });
  
  const invalidJsonResponse = await invalidJsonResult.json();
  assert(invalidJsonResponse.error);
  assert.equal(invalidJsonResponse.error.code, -32700); // Parse error
  
  // Test timeout handling (if applicable)
  const timeoutResult = await fetch('/mcp/hello-world?timeout=true', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "timeout-1",
      method: "tool.call",
      params: {
        id: "call-1",
        name: "slow_tool", // A tool that takes a long time
        arguments: {}
      }
    })
  });
  
  // Should either complete successfully or return timeout error
  const timeoutResponse = await timeoutResult.json();
  assert(timeoutResponse.result || timeoutResponse.error);
}
```

## 4. End-to-End Testing

### 4.1 Claude Desktop Integration Testing

Test integration with Claude Desktop:

```
1. Configure Claude Desktop with the MCP server URL
2. Verify initialization and tool discovery occurs
3. Ask Claude to use the tools and verify results
4. Test with complex scenarios that require multiple tool calls
```

### 4.2 LLM-Driven Test Scenarios

Use LLMs to generate complex test scenarios:

```
1. Ask Claude to generate diverse test cases for tools
2. Implement the test cases and verify results
3. Use Claude to analyze test results and suggest improvements
4. Iterate on tools based on real usage patterns
```

### 4.3 Load Testing

Test performance under load:

```javascript
async function runLoadTest() {
  // Run multiple concurrent requests
  const concurrentRequests = 100;
  const startTime = Date.now();
  
  const requests = Array(concurrentRequests).fill().map((_, i) => 
    sendRequest({
      jsonrpc: "2.0",
      id: `load-${i}`,
      method: "tool.call",
      params: {
        id: `call-${i}`,
        name: "hello_world",
        arguments: { name: `User-${i}` }
      }
    })
  );
  
  const results = await Promise.all(requests);
  const endTime = Date.now();
  
  // Calculate performance metrics
  const totalTime = endTime - startTime;
  const successRate = results.filter(r => r.result).length / results.length;
  const avgResponseTime = totalTime / concurrentRequests;
  
  console.log(`Load test results:
    - Concurrent requests: ${concurrentRequests}
    - Total time: ${totalTime}ms
    - Success rate: ${successRate * 100}%
    - Average response time: ${avgResponseTime}ms
  `);
}
```

## 5. Security Testing

### 5.1 Input Validation Testing

Test protection against malicious inputs:

```javascript
async function testSecurityValidation() {
  // Test SQL injection attempt
  const sqlInjectionResult = await sendRequest({
    jsonrpc: "2.0",
    id: "sec-1",
    method: "tool.call",
    params: {
      id: "call-1",
      name: "echo",
      arguments: {
        message: "'; DROP TABLE users; --"
      }
    }
  });
  
  // Should sanitize the input and not fail
  assert(sqlInjectionResult.result);
  
  // Test XSS attempt
  const xssResult = await sendRequest({
    jsonrpc: "2.0",
    id: "sec-2",
    method: "tool.call",
    params: {
      id: "call-2",
      name: "echo",
      arguments: {
        message: "<script>alert('XSS')</script>"
      }
    }
  });
  
  // Should sanitize the input
  assert(xssResult.result);
  assert(!xssResult.result.repeated.includes("<script>"));
}
```

### 5.2 Authentication Testing

Test authentication mechanisms:

```javascript
async function testAuthentication() {
  // Test without authentication
  const unauthenticatedResult = await fetch('/mcp/hello-world', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "auth-1",
      method: "tool.list",
      params: {}
    })
  });
  
  // Should require authentication if enabled
  if (process.env.REQUIRE_AUTH === 'true') {
    assert.equal(unauthenticatedResult.status, 401);
  }
  
  // Test with valid authentication
  const authenticatedResult = await fetch('/mcp/hello-world', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TEST_API_KEY}`
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "auth-2",
      method: "tool.list",
      params: {}
    })
  });
  
  assert.equal(authenticatedResult.status, 200);
}
```

## 6. Automated Testing Setup

### 6.1 Unit Testing

Set up Jest for unit testing:

```javascript
// Example Jest test for the validation utility
describe('Validation Utilities', () => {
  test('validateToolArguments with valid arguments', () => {
    const toolDef = {
      name: 'test_tool',
      description: 'Test tool',
      parameters: {
        required_param: {
          type: 'string',
          description: 'Required parameter',
          required: true
        },
        optional_param: {
          type: 'number',
          description: 'Optional parameter',
          required: false
        }
      }
    };
    
    const args = {
      required_param: 'test',
      optional_param: 42
    };
    
    const result = validateToolArguments(toolDef, args);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
  
  test('validateToolArguments with missing required argument', () => {
    const toolDef = {
      name: 'test_tool',
      description: 'Test tool',
      parameters: {
        required_param: {
          type: 'string',
          description: 'Required parameter',
          required: true
        }
      }
    };
    
    const args = {};
    
    const result = validateToolArguments(toolDef, args);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('Missing required parameter');
  });
});
```

### 6.2 Integration Testing

Set up integration tests with supertest:

```javascript
// Example supertest integration test
const request = require('supertest');
const express = require('express');
const { setupMCPServer } = require('../dist/scripts/local-server');

describe('MCP Server Integration', () => {
  let app;
  
  beforeAll(() => {
    app = express();
    setupMCPServer(app);
  });
  
  test('Initialize sequence', async () => {
    const response = await request(app)
      .post('/mcp/hello-world')
      .send({
        jsonrpc: '2.0',
        id: 'test-1',
        method: 'initialize',
        params: {
          client: {
            name: 'Test Client',
            version: '1.0.0'
          }
        }
      });
    
    expect(response.status).toBe(200);
    expect(response.body.result).toBeDefined();
    expect(response.body.result.server).toBeDefined();
    expect(response.body.result.server.name).toBe('hello-world-mcp');
  });
  
  test('Tool call execution', async () => {
    const response = await request(app)
      .post('/mcp/hello-world')
      .send({
        jsonrpc: '2.0',
        id: 'test-2',
        method: 'tool.call',
        params: {
          id: 'call-1',
          name: 'hello_world',
          arguments: {
            name: 'Integration Test'
          }
        }
      });
    
    expect(response.status).toBe(200);
    expect(response.body.result).toBeDefined();
    expect(response.body.result.result).toBeDefined();
    expect(response.body.result.result.greeting).toContain('Integration Test');
  });
});
```

### 6.3 CI/CD Integration

Integrate tests with CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
name: Lambda-MCP Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run unit tests
      run: npm test
      
    - name: Run integration tests
      run: npm run test:integration
      
    - name: Run protocol compliance tests
      run: npm run test:protocol
      
    - name: Build project
      run: npm run build
```

## Conclusion

A comprehensive testing strategy is essential for ensuring the reliability and correctness of Lambda-MCP servers. By implementing these testing approaches, you can verify that your MCP servers correctly implement the protocol specification, provide robust tool functionality, and handle edge cases appropriately.

Regular testing throughout the development process helps catch issues early and ensures that changes don't break existing functionality. The combination of unit tests, integration tests, and end-to-end tests provides comprehensive coverage of the entire system.
