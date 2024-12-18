@echo off
setlocal enabledelayedexpansion

set "SRC_DIR=node_modules\@risemaxi\api-client\src"
set "DIST_DIR=node_modules\@risemaxi\api-client\dist"
set "OUTPUT_FILE=%SRC_DIR%\contract.ts"

:generate_file
set "INPUT_FILE=%~1"

if "%INPUT_FILE%"=="" (
    echo Error: input swagger is required for the generate command.
    exit /b 1
)

REM Create the source directory if it doesn't exist
if not exist "%SRC_DIR%" (
    mkdir "%SRC_DIR%"
)

REM Run the typed-openapi command
npx typed-openapi "%INPUT_FILE%" -o "%OUTPUT_FILE%" -r typebox

echo Compiling TypeScript to JavaScript...
npx tsc --project "%SRC_DIR%\..\tsconfig.build.json"

REM Remove the source directory
rmdir /s /q "%SRC_DIR%"

echo File generated and compiled successfully.
exit /b 0

:display_help
echo Usage: rise-api [command] [options]
echo.
echo Commands:
echo   generate [content]  Generate a file with the specified content and compile to JavaScript
echo   help                Display this help message
exit /b 0

REM Main logic
if "%~1"=="" (
    echo Error: Unknown command.
    call :display_help
    exit /b 1
)

if "%~1"=="generate" (
    call :generate_file "%~2"
    exit /b 0
)

if "%~1"=="help" (
    call :display_help
    exit /b 0
)

echo Error: Unknown command '%~1'
call :display_help
exit /b 1
