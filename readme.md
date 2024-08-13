# Rise API client

This package contains an api client for Risevest. The contract is generated from an OpenAPI file, and then a client is built around this contract.

It uses [typebox](https://github.com/sinclairzx81/typebox-codegen "typebox") to generate the contract from an OpenAPI file, and also `react-query`

## Installation

```shell
npm install @risemaxi/api-client --save
```

OR

```shell
yarn add @risemaxi/api-client
OR
```

```shell
bun install @risemaxi/api-client
```

## Usage

This lib also ships with a cli `rise-api`, so you can use it to generate the contract at will, just run:

```shell
bunx rise-api generate <input-file>
```

The input file can be a local file or a url pointing to a file.
For example

```shell
bunx rise-api generate ./swagger.yaml
```
