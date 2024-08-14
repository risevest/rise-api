import type { Endpoint, EndpointParameters, Method } from "./contract.ts";

export type HttpMethod = "post" | "get" | "patch" | "delete";
export type Fetcher = (
  method: Method,
  url: string,
  parameters?: EndpointParameters | undefined
) => Promise<Endpoint["response"]>;

export type RequiredKeys<T> = {
  [P in keyof T]-?: undefined extends T[P] ? never : P;
}[keyof T];

export type MaybeOptionalArg<T> = RequiredKeys<T> extends never
  ? [config?: T]
  : [config: T];

export type MaybeOptionalOptions<T, O> = RequiredKeys<T> extends never
  ? [config?: T, options?: O]
  : [config: T, options?: O];
