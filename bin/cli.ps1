# Define directories and output file
$SRC_DIR = "node_modules\@risemaxi\api-client\src"
$DIST_DIR = "node_modules\@risemaxi\api-client\dist"
$OUTPUT_FILE = Join-Path $SRC_DIR "contract.ts"

function Generate-File {
    param (
        [string]$InputFile
    )

    if (-not $InputFile) {
        Write-Host "Error: input swagger is required for the generate command." -ForegroundColor Red
        exit 1
    }

    # Create the source directory if it doesn't exist
    if (-not (Test-Path $SRC_DIR)) {
        New-Item -ItemType Directory -Path $SRC_DIR | Out-Null
    }

    # Run the typed-openapi command
    Write-Host "Generating TypeScript contract from OpenAPI..."
    npx typed-openapi $InputFile -o $OUTPUT_FILE -r typebox

    # Compile TypeScript to JavaScript
    Write-Host "Compiling TypeScript to JavaScript..."
    npx tsc --project (Join-Path $SRC_DIR "..\tsconfig.build.json")

    # Remove the source directory
    Remove-Item -Recurse -Force $SRC_DIR

    Write-Host "File generated and compiled successfully." -ForegroundColor Green
}

function Display-Help {
    Write-Host "Usage: rise-api [command] [options]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  generate [content]  Generate a file with the specified content and compile to JavaScript"
    Write-Host "  help                Display this help message"
}

# Main logic
param (
    [string]$Command,
    [string]$Option
)

switch ($Command) {
    "generate" {
        Generate-File -InputFile $Option
    }
    "help" {
        Display-Help
    }
    default {
        Write-Host "Error: Unknown command '$Command'" -ForegroundColor Red
        Display-Help
        exit 1
    }
}
