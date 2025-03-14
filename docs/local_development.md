# Local Development Guide for Lambda-MCP

This guide provides detailed instructions for developing and testing Lambda-MCP servers locally before deploying them to AWS.

## Setting Up Your Local Environment

### Prerequisites

- Node.js 18 or later
- npm or yarn
- Git (for version control)
- Visual Studio Code (recommended) or another IDE

### Initial Setup

1. Clone the repository (or create a new project):
   ```bash
   git clone https://github.com/yourusername/lambda-mcp.git
   cd lambda-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Install development utilities:
   ```bash
   npm install --save-dev nodemon ts-node concurrently express @types/express
   ```

## Setting Up Local Server

The Lambda function normally runs in AWS, triggered by API Gateway. For local development, we'll create an Express server that simulates this environment.

### Create a Local Development Server

Create a file at `scripts/local-server.ts`:

```typescript
import express from 'express';
import * as path from 'path';
import { handler as helloWorldHandler } from '../src/examples/hello-world';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Endpoint for Hello World MCP server
app.post('/mcp/hello-world', async (req, res) => {
  try {
    // Create API Gateway event
    const event = {
      body: JSON.stringify(req.body),
      headers: req.headers as Record<string, string>,
      httpMethod: 'POST',
      path: '/mcp/hello-world',
      queryStringParameters: req.query as Record<string, string>
    };

    // Call the Lambda handler
    const result = await helloWorldHandler(event as any, {} as any);

    // Set status code and headers
    res.status(result.statusCode);
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value as string);
      });
    }

    // Send response body
    res.send(result.body);
  } catch (error) {
    console.error('Error handling request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add static file serving for testing UI (optional)
app.use(express.static(path.join(__dirname, '../public')));

// Start the server
app.listen(PORT, () => {
  console.log(`MCP local development server running at http://localhost:${PORT}`);
  console.log(`Hello World MCP endpoint: http://localhost:${PORT}/mcp/hello-world`);
});
```

### Update package.json Scripts

Add these scripts to your `package.json`:

```json
"scripts": {
  "build": "tsc",
  "watch": "tsc -w",
  "dev": "concurrently \"npm run watch\" \"nodemon dist/scripts/local-server.js\"",
  "dev:ts": "ts-node scripts/local-server.ts",
  "test": "jest"
}
```

## Creating a Testing UI

For easier testing, create a simple HTML interface to interact with your MCP server.

### Create HTML Testing Interface

Create a file at `public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lambda-MCP Tester</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      display: flex;
      gap: 20px;
    }
    .panel {
      flex: 1;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 15px;
    }
    textarea {
      width: 100%;
      height: 300px;
      font-family: monospace;
      margin-bottom: 10px;
    }
    button {
      background-color: #4CAF50;
      color: white;
      border: none;
      padding: 10px 15px;
      text-align: center;
      text-decoration: none;
      display: inline-block;
      font-size: 16px;
      margin: 4px 2px;
      cursor: pointer;
      border-radius: 4px;
    }
    .template-button {
      background-color: #2196F3;
    }
    .history {
      margin-top: 20px;
    }
    .history-item {
      padding: 10px;
      margin-bottom: 10px;
      background-color: #f9f9f9;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>Lambda-MCP Tester</h1>
  
  <div class="container">
    <div class="panel">
      <h2>Request</h2>
      <select id="template-select">
        <option value="">Select a template...</option>
        <option value="initialize">initialize</option>
        <option value="tool-list">tool.list</option>
        <option value="hello-world">hello_world tool</option>
        <option value="current-time">current_time tool</option>
      </select>
      <button class="template-button" id="load-template">Load Template</button>
      <textarea id="request-body">{
  "jsonrpc": "2.0",
  "id": "req-1",
  "method": "initialize",
  "params": {
    "client": {
      "name": "Browser Tester",
      "version": "1.0.0"
    }
  }
}</textarea>
      <button id="send-request">Send Request</button>
    </div>
    
    <div class="panel">
      <h2>Response</h2>
      <textarea id="response-body" readonly></textarea>
      <div>
        <span>Status: </span><span id="status-code">-</span>
      </div>
    </div>
  </div>
  
  <div class="history">
    <h2>History</h2>
    <div id="history-container"></div>
  </div>

  <script>
    const templates = {
      initialize: {
        jsonrpc: "2.0",
        id: "req-1",
        method: "initialize",
        params: {
          client: {
            name: "Browser Tester",
            version: "1.0.0"
          }
        }
      },
      "tool-list": {
        jsonrpc: "2.0",
        id: "req-2",
        method: "tool.list",
        params: {}
      },
      "hello-world": {
        jsonrpc: "2.0",
        id: "req-3",
        method: "tool.call",
        params: {
          id: "call-1",
          name: "hello_world",
          arguments: {
            name: "User",
            language: "english"
          }
        }
      },
      "current-time": {
        jsonrpc: "2.0",
        id: "req-4",
        method: "tool.call",
        params: {
          id: "call-2",
          name: "current_time",
          arguments: {
            format: "iso"
          }
        }
      }
    };

    document.getElementById('load-template').addEventListener('click', () => {
      const template = document.getElementById('template-select').value;
      if (template && templates[template]) {
        document.getElementById('request-body').value = JSON.stringify(templates[template], null, 2);
      }
    });

    document.getElementById('send-request').addEventListener('click', async () => {
      const requestBody = document.getElementById('request-body').value;
      const responseBodyEl = document.getElementById('response-body');
      const statusCodeEl = document.getElementById('status-code');
      
      try {
        const response = await fetch('/mcp/hello-world', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: requestBody
        });
        
        statusCodeEl.textContent = response.status;
        
        const responseData = await response.json();
        responseBodyEl.value = JSON.stringify(responseData, null, 2);
        
        // Add to history
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const timestamp = new Date().toISOString();
        const requestObj = JSON.parse(requestBody);
        const method = requestObj.method;
        
        historyItem.innerHTML = `
          <div><strong>Time:</strong> ${timestamp}</div>
          <div><strong>Method:</strong> ${method}</div>
          <div><strong>Status:</strong> ${response.status}</div>
          <details>
            <summary>Request</summary>
            <pre>${JSON.stringify(JSON.parse(requestBody), null, 2)}</pre>
          </details>
          <details>
            <summary>Response</summary>
            <pre>${JSON.stringify(responseData, null, 2)}</pre>
          </details>
        `;
        
        document.getElementById('history-container').prepend(historyItem);
      } catch (error) {
        responseBodyEl.value = `Error: ${error.message}`;
        statusCodeEl.textContent = 'Error';
      }
    });
  </script>
</body>
</html>
```

## Setting Up VS Code Debugging

To enable debugging in VS Code, create a `.vscode/launch.json` file:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Local Server",
      "program": "${workspaceFolder}/scripts/local-server.ts",
      "preLaunchTask": "tsc: build - tsconfig.json",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "sourceMaps": true,
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug TS-Node",
      "runtimeExecutable": "node",
      "runtimeArgs": [
        "--require", "ts-node/register",
        "${workspaceFolder}/scripts/local-server.ts"
      ],
      "console": "integratedTerminal",
      "sourceMaps": true
    }
  ]
}
```

## Testing with the Claude Desktop MCP Client

To test your locally running MCP server with Claude Desktop:

1. Expose your local server with a tool like ngrok:
   ```bash
   npm install -g ngrok
   ngrok http 3000
   ```

2. Get the public URL from ngrok (e.g., `https://abcd1234.ngrok.io`).

3. Configure Claude Desktop to use this URL for your MCP server:
   - Open Claude Desktop settings
   - Add a new MCP server with the URL: `https://abcd1234.ngrok.io/mcp/hello-world`

## Creating a Mock MCP Client

For automated testing, create a mock MCP client at `scripts/mock-mcp-client.ts`:

```typescript
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const MCP_URL = process.env.MCP_URL || 'http://localhost:3000/mcp/hello-world';

async function sendRequest(body: any) {
  console.log(`Sending request to ${MCP_URL}:`, JSON.stringify(body, null, 2));
  
  try {
    const response = await axios.post(MCP_URL, body, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

async function runConversation() {
  // 1. Initialize
  const initResult = await sendRequest({
    jsonrpc: '2.0',
    id: 'req-1',
    method: 'initialize',
    params: {
      client: {
        name: 'Mock MCP Client',
        version: '1.0.0',
      },
    },
  });
  
  console.log('\n--- Server initialized ---\n');
  
  // 2. Send initialized notification
  await sendRequest({
    jsonrpc: '2.0',
    method: 'initialized',
    params: {},
  });
  
  console.log('\n--- Sent initialized notification ---\n');
  
  // 3. Get tool list
  const toolListResult = await sendRequest({
    jsonrpc: '2.0',
    id: 'req-2',
    method: 'tool.list',
    params: {},
  });
  
  console.log('\n--- Got tool list ---\n');
  
  // 4. Call hello_world tool
  const helloResult = await sendRequest({
    jsonrpc: '2.0',
    id: 'req-3',
    method: 'tool.call',
    params: {
      id: 'call-1',
      name: 'hello_world',
      arguments: {
        name: 'Developer',
        language: 'french',
      },
    },
  });
  
  console.log('\n--- Called hello_world tool ---\n');
  
  // 5. Call current_time tool
  const timeResult = await sendRequest({
    jsonrpc: '2.0',
    id: 'req-4',
    method: 'tool.call',
    params: {
      id: 'call-2',
      name: 'current_time',
      arguments: {
        format: 'iso',
      },
    },
  });
  
  console.log('\n--- Called current_time tool ---\n');
  
  console.log('Conversation complete!');
}

// Run the mock client
runConversation().catch(console.error);
```

Install required dependencies:
```bash
npm install --save-dev axios
```

## Environment Variables for Local Development

Create a `.env.development` file for local development:

```
MCP_SERVER_PORT=3000
LOG_LEVEL=debug
```

Install dotenv for environment variable loading:
```bash
npm install --save-dev dotenv
```

Update the local server script to use environment variables:

```typescript
// Add at the beginning of local-server.ts
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
```

## Iterative Development Workflow

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Make changes to your code**:
   - Modify MCP server implementation
   - Add new tools
   - Update validation logic

3. **Test changes in real-time**:
   - The server will automatically reload when you make changes
   - Use the web UI at http://localhost:3000 to test your MCP server
   - Or use the mock client: `ts-node scripts/mock-mcp-client.ts`

4. **Debug issues**:
   - Set breakpoints in VS Code
   - Check the console logs
   - Use the VS Code debugger to step through code

5. **Prepare for deployment**:
   - Build the project: `npm run build`
   - Test the built version: `node dist/scripts/local-server.js`
   - Deploy to AWS when ready: `npm run deploy:hello-world`

## Tips for Effective Local Development

1. **Use TypeScript Watch Mode**: 
   Keep the TypeScript compiler running in watch mode to automatically compile changes.

2. **Set Up Proper Logging**:
   Implement detailed logging to help debug issues. Consider using a library like winston.

3. **Test Different MCP Clients**:
   Test with both the mock client and real clients like Claude Desktop.

4. **Simulate Edge Cases**:
   Create test cases for error conditions, invalid inputs, and edge cases.

5. **Use Git for Version Control**:
   Make small, focused commits to track your changes.

6. **Document Your Tools**:
   Maintain good documentation for your tools and server behavior.

7. **Write Unit Tests**:
   Create unit tests for your tools and core functionality.

## Conclusion

This local development setup allows you to build and test your Lambda-MCP servers efficiently, without needing to deploy to AWS for every change. The web UI and mock client provide easy ways to interact with your MCP server, while the debugging configuration helps you resolve issues quickly.

By following this guide, you can create a productive development environment for building MCP servers with Lambda-MCP.
