// <EndpointByMethod>
export type PostEndpoints = {};

export type GetEndpoints = {};

export type PatchEndpoints = {};

export type DeleteEndpoints = {};

export type PutEndpoints = {};

// <EndpointSchemaLookup>
export function getEndpointSchema(method: string, path: string): unknown {
  switch (method) {
    case "post":
      switch (path) {
        default:
          return undefined;
      }
    case "get":
      switch (path) {
        default:
          return undefined;
      }
    case "patch":
      switch (path) {
        default:
          return undefined;
      }
    case "delete":
      switch (path) {
        default:
          return undefined;
      }
    case "put":
      switch (path) {
        default:
          return undefined;
      }
    default:
      return undefined;
  }
}
