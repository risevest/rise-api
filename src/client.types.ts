import type {
  DeleteEndpoints,
  GetEndpoints,
  PatchEndpoints,
  PostEndpoints,
  PutEndpoints,
} from "./contract.js";

export type HttpMethod = "post" | "get" | "patch" | "delete" | "put";
export type Fetcher = (
  method: HttpMethod,
  url: string,
  parameters?:
    | {
        body?: unknown;
        query?: Record<string, unknown>;
        header?: Record<string, unknown>;
        path?: Record<string, unknown>;
      }
    | undefined
) => Promise<unknown>;

export type RequiredKeys<T> = {
  [P in keyof T]-?: undefined extends T[P] ? never : P;
}[keyof T];

export type MaybeOptionalArg<T> = RequiredKeys<T> extends never ? [config?: T] : [config: T];

export type MaybeOptionalOptions<T, O> = RequiredKeys<T> extends never
  ? [config?: T, options?: O]
  : [config: T, options?: O];

export type EndpointInputParameters<TEndpoint> =
  TEndpoint extends { parameters: infer TParameters } ? TParameters : never;

export type EndpointOutputResponse<TEndpoint> =
  TEndpoint extends { response: infer TResponse } ? TResponse : never;

export type EndpointMethodMap = {
  delete: DeleteEndpoints;
  get: GetEndpoints;
  patch: PatchEndpoints;
  post: PostEndpoints;
  put: PutEndpoints;
};
