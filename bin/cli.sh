#!/bin/bash

OUTPUT_FILE="node_modules/rise-api/src/contract.ts"

generate_file() {
  local INPUT_FILE="$1"

  if [ -z "$INPUT_FILE" ]; then
    echo "Error: input swagger is required for the generate command."
    exit 1
  fi
  
  npx typed-openapi "$INPUT_FILE" -o "$OUTPUT_FILE" -r typebox
}

display_help() {
  echo "Usage: rise-api [command] [options]"
  echo ""
  echo "Commands:"
  echo "  generate [content]  Generate a file with the specified content"
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
