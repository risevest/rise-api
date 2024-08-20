#!/bin/bash

SRC_DIR="node_modules/@risemaxi/api-client/src"
DIST_DIR="node_modules/@risemaxi/api-client/dist"
OUTPUT_FILE="$SRC_DIR/contract.ts"

generate_file() {
  local INPUT_FILE="$1"

  if [ -z "$INPUT_FILE" ]; then
    echo "Error: input swagger is required for the generate command."
    exit 1
  fi
  
  npx typed-openapi "$INPUT_FILE" -o "$OUTPUT_FILE" -r typebox

  echo "Compiling TypeScript to JavaScript..."
  npx tsc --project "$SRC_DIR/../tsconfig.build.json"

  echo "File generated and compiled successfully."
}

display_help() {
  echo "Usage: rise-api [command] [options]"
  echo ""
  echo "Commands:"
  echo "  generate [content]  Generate a file with the specified content and compile to JavaScript"
  echo "  help                Display this help message"
}

case "$1" in
  generate)
    generate_file "$2"
    ;;
  help)
    display_help
    ;;
  *)
    echo "Error: Unknown command '$1'"
    display_help
    exit 1
    ;;
esac
