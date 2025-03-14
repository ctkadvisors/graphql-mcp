#!/bin/bash

# This script runs the GitHub GraphQL API test with a sample token

# Check if token is provided as argument
if [ -z "$1" ]; then
  echo "Please provide a GitHub token as an argument:"
  echo "./test/run-github-test.sh your_github_token"
  exit 1
fi

# Set the GitHub token environment variable
export GITHUB_TOKEN=$1

# Compile TypeScript
echo "Building the TypeScript code..."
npm run build

# Run the GitHub test
echo "Running GitHub GraphQL API test..."
npm run test:github
