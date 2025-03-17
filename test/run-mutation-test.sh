#!/bin/bash

# Run the mutation test script

# Make sure the TypeScript is compiled
echo "Compiling TypeScript..."
cd ..
npm run build

# Set up GitHub token if provided
if [ ! -z "$1" ]; then
  export GITHUB_TOKEN="$1"
  echo "Using provided GitHub token"
else
  echo "No GitHub token provided, running in simulation mode"
fi

# Run the test
echo "Running mutation test..."
cd test
ts-node test-mutations.ts
