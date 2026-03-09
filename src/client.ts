import { StaticDecode, TAny, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  FetchQueryOptions,
  InfiniteData,
  MutationKey,
  QueryClient,
  QueryFunctionContext,
  QueryKey,
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
  useMutation,
  UseMutationOptions,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";

import type {
  EndpointMethodMap,
  EndpointInputParameters,
  EndpointOutputResponse,
  Fetcher,
  HttpMethod,
  MaybeOptionalArg,
  MaybeOptionalOptions,
} from "./client.types.js";
import type {
  DeleteEndpoints,
  GetEndpoints,
  PatchEndpoints,
  PostEndpoints,
  PutEndpoints,
} from "./contract.js";

export class RiseApiClient {
  #baseUrl: string = "";
  #enabledParsing: boolean = true;

  constructor(public fetcher: Fetcher) {}

  setBaseUrl(baseUrl: string) {
    this.#baseUrl = baseUrl;
    return this;
  }

  setEnableParsing(enable: boolean) {
    this.#enabledParsing = enable;
    return this;
  }

  #parse<T extends TSchema>(schema: T, value: unknown): StaticDecode<T, []> {
    return this.#enabledParsing ? Value.Parse(schema, value) : value;
  }

  #parseAsync<T extends TSchema>(
    schema: T,
    value: Promise<unknown>
  ): Promise<StaticDecode<T, []>> {
    return value.then((res) => this.#parse(schema, res));
  }

  #constructPath(template: string, params?: Record<string, string>) {
    if (!params) {
      return template;
    }

    return template.replace(/{(\w+)}/g, (match, key) => {
      if (key in params) {
        return params[key];
      }
      return match;
    });
  }

  async #request<M extends HttpMethod, P extends keyof EndpointMethodMap[M]>(
    method: M,
    path: P,
    ...params: any[]
  ): Promise<any> {
    const parameters = params[0];
    const finalPath = this.#constructPath(path as string, parameters?.path);

    if (!this.#enabledParsing) {
      return this.fetcher(method, this.#baseUrl + finalPath, parameters);
    }

    const { getEndpointSchema } = await import("./contract.js");
    const endpointSchema = getEndpointSchema(method, path as string) as
      | TAny
      | undefined;

    if (!endpointSchema?.properties) {
      throw new Error(
        `Unknown endpoint schema for ${method.toUpperCase()} ${String(path)}`
      );
    }

    const endpointProperties = endpointSchema.properties as {
      parameters?: TAny;
      response: TAny;
    };
    const parsedParameters = endpointProperties.parameters
      ? this.#parse(endpointProperties.parameters, parameters)
      : parameters;

    return this.#parseAsync(
      endpointProperties.response,
      this.fetcher(
        method,
        this.#baseUrl + finalPath,
        parsedParameters
      )
    );
  }

  get<Path extends keyof GetEndpoints>(
    path: Path,
    ...params: MaybeOptionalArg<GetEndpoints[Path]["parameters"]>
  ): Promise<GetEndpoints[Path]["response"]> {
    return this.#request("get", path, ...params);
  }

  post<Path extends keyof PostEndpoints>(
    path: Path,
    ...params: MaybeOptionalArg<PostEndpoints[Path]["parameters"]>
  ): Promise<PostEndpoints[Path]["response"]> {
    return this.#request("post", path, ...params);
  }

  patch<Path extends keyof PatchEndpoints>(
    path: Path,
    ...params: MaybeOptionalArg<PatchEndpoints[Path]["parameters"]>
  ): Promise<PatchEndpoints[Path]["response"]> {
    return this.#request("patch", path, ...params);
  }

  delete<Path extends keyof DeleteEndpoints>(
    path: Path,
    ...params: MaybeOptionalArg<DeleteEndpoints[Path]["parameters"]>
  ): Promise<DeleteEndpoints[Path]["response"]> {
    return this.#request("delete", path, ...params);
  }

  put<Path extends keyof PutEndpoints>(
    path: Path,
    ...params: MaybeOptionalArg<PutEndpoints[Path]["parameters"]>
  ): Promise<PutEndpoints[Path]["response"]> {
    return this.#request("put", path, ...params);
  }
}

export function createRiseApiClient(fetcher: Fetcher) {
  return new RiseApiClient(fetcher);
}

export class RiseApiHooks {
  #client: RiseApiClient;
  constructor(client: RiseApiClient) {
    this.#client = client;
  }

  getCacheKey<
    Method extends HttpMethod,
    Path extends keyof EndpointMethodMap[Method]
  >(
    method: Method,
    path: Path,
    ...params: MaybeOptionalArg<
      EndpointInputParameters<EndpointMethodMap[Method][Path]>
    >
  ): readonly [string, ...unknown[]] {
    const key = `${method}_${path as string}`;
    return [key, ...params];
  }

  setCachedData<
    Method extends HttpMethod,
    Path extends keyof EndpointMethodMap[Method]
  >(
    queryClient: QueryClient,
    method: Method,
    path: Path,
    ...options: MaybeOptionalOptions<
      EndpointOutputResponse<EndpointMethodMap[Method][Path]>,
      EndpointInputParameters<EndpointMethodMap[Method][Path]>
    >
  ): void {
    const [data, ...params] = options;
    const queryKey = this.getCacheKey(
      method,
      path as any,
      ...(params as never)
    );

    queryClient.setQueryData(queryKey, data);
  }

  useSetCachedData<
    Method extends HttpMethod,
    Path extends keyof EndpointMethodMap[Method]
  >(
    method: Method,
    path: Path,
    ...options: MaybeOptionalOptions<
      EndpointOutputResponse<EndpointMethodMap[Method][Path]>,
      EndpointInputParameters<EndpointMethodMap[Method][Path]>
    >
  ): void {
    const queryClient = useQueryClient();

    this.setCachedData(queryClient, method, path as any, ...options);
  }

  getCachedData<
    Method extends HttpMethod,
    Path extends keyof EndpointMethodMap[Method]
  >(
    queryClient: QueryClient,
    method: Method,
    path: Path,
    ...params: MaybeOptionalArg<
      EndpointInputParameters<EndpointMethodMap[Method][Path]>
    >
  ): EndpointOutputResponse<EndpointMethodMap[Method][Path]> | undefined {
    const queryKey = this.getCacheKey(method, path as any, ...params);

    return queryClient.getQueryData(queryKey);
  }

  useGetCachedData<
    Method extends HttpMethod,
    Path extends keyof EndpointMethodMap[Method]
  >(
    method: Method,
    path: Path,
    ...params: MaybeOptionalArg<
      EndpointInputParameters<EndpointMethodMap[Method][Path]>
    >
  ): EndpointOutputResponse<EndpointMethodMap[Method][Path]> | undefined {
    const queryClient = useQueryClient();

    return this.getCachedData(queryClient, method, path as any, ...params);
  }

  prefetchData<Path extends keyof GetEndpoints>(
    queryClient: QueryClient,
    path: Path,
    ...rest: MaybeOptionalOptions<
      GetEndpoints[Path]["parameters"],
      FetchQueryOptions
    >
  ) {
    const [config, options] = rest;
    const queryKey = this.getCacheKey("get", path, config as never);
    const queryFn = () => this.#client.get(path, config as never);

    queryClient.prefetchQuery({
      ...options,
      queryKey,
      queryFn,
    });
  }

  usePrefetchData<Path extends keyof GetEndpoints>(
    path: Path,
    ...rest: MaybeOptionalOptions<
      GetEndpoints[Path]["parameters"],
      FetchQueryOptions
    >
  ) {
    const queryClient = useQueryClient();

    this.prefetchData(queryClient, path, ...rest);
  }

  useGet<
    Path extends keyof GetEndpoints,
    TQueryFnData extends GetEndpoints[Path]["response"],
    TError = unknown,
    TData = TQueryFnData
  >(
    path: Path,
    ...rest: MaybeOptionalOptions<
      GetEndpoints[Path]["parameters"],
      Omit<UseQueryOptions<TQueryFnData, TError, TData>, "queryKey" | "queryFn">
    >
  ): UseQueryResult<TData, TError> & {
    invalidate: () => Promise<void>;
    queryKey: QueryKey;
  } {
    const queryClient = useQueryClient();
    const [config, options] = rest;
    const queryKey = this.getCacheKey("get", path, config as never);
    const invalidate = () =>
      queryClient.invalidateQueries({
        exact: true,
        queryKey,
      });

    return Object.assign(
      useQuery({
        queryFn: () => this.#client.get(path, config as never),
        queryKey,
        ...(options as {}),
      }),
      { invalidate, queryKey }
    ) as never;
  }

  useInfiniteGet<
    Path extends keyof GetEndpoints,
    TData extends GetEndpoints[Path]["response"],
    TError = Error
  >(
    path: Path,
    configMapper: (
      context: QueryFunctionContext<QueryKey>
    ) => GetEndpoints[Path]["parameters"],
    options: Omit<
      UseInfiniteQueryOptions<TData, TError>,
      "queryKey" | "queryFn"
    >
  ): UseInfiniteQueryResult<InfiniteData<TData>, TError> & {
    invalidate: () => Promise<void>;
    queryKey: QueryKey;
  } {
    const queryClient = useQueryClient();
    const queryKey = this.getCacheKey(
      "get",
      path,
      configMapper({
        meta: {},
        queryKey: [],
        signal: new AbortController().signal,
        client: queryClient,
      })
    );
    const queryFn = (context: QueryFunctionContext<QueryKey>) => {
      const config = configMapper(context);
      return this.#client.get(path, config as never);
    };
    const invalidate = () =>
      queryClient.invalidateQueries({
        queryKey,
      });

    return Object.assign(
      useInfiniteQuery<TData, TError>({
        queryFn,
        queryKey,
        ...(options as any),
      }),
      { invalidate, queryKey }
    );
  }

  usePost<
    Path extends keyof PostEndpoints,
    TVariables extends PostEndpoints[Path]["parameters"],
    TData extends PostEndpoints[Path]["response"],
    TError = unknown
  >(
    path: Path,
    options?: Omit<
      UseMutationOptions<TData, TError, TVariables>,
      "mutationKey" | "mutationFn"
    >
  ): UseMutationResult<TData, TError, TVariables> & {
    mutationKey: MutationKey;
  } {
    const mutationKey = this.getCacheKey("post", path, {} as never);

    return Object.assign(
      useMutation({
        mutationFn: (params: PostEndpoints[Path]["parameters"]) =>
          this.#client.post(path, params as never),
        mutationKey,
        ...(options as {}),
      }),
      { mutationKey }
    ) as never;
  }

  usePatch<
    Path extends keyof PatchEndpoints,
    TVariables extends PatchEndpoints[Path]["parameters"],
    TData extends PatchEndpoints[Path]["response"],
    TError = unknown
  >(
    path: Path,
    options?: Omit<
      UseMutationOptions<TData, TError, TVariables>,
      "mutationKey" | "mutationFn"
    >
  ): UseMutationResult<TData, TError, TVariables> & {
    mutationKey: MutationKey;
  } {
    const mutationKey = this.getCacheKey("patch", path, {} as never);

    return Object.assign(
      useMutation({
        mutationFn: (params: TVariables) =>
          this.#client.patch(path, params as never),
        mutationKey,
        ...(options as {}),
      }),
      { mutationKey }
    ) as never;
  }

  useDelete<
    Path extends keyof DeleteEndpoints,
    TVariables extends DeleteEndpoints[Path]["parameters"],
    TData extends DeleteEndpoints[Path]["response"],
    TError = unknown
  >(
    path: Path,
    options?: Omit<
      UseMutationOptions<TData, TError, TVariables>,
      "mutationKey" | "mutationFn"
    >
  ): UseMutationResult<TData, TError, TVariables> & {
    mutationKey: MutationKey;
  } {
    const mutationKey = this.getCacheKey("delete", path, {} as never);

    return Object.assign(
      useMutation({
        mutationFn: (params: TVariables) =>
          this.#client.delete(path, params as never),
        mutationKey,
        ...(options as {}),
      }),
      { mutationKey }
    ) as never;
  }

  usePut<
    Path extends keyof PutEndpoints,
    TVariables extends PutEndpoints[Path]["parameters"],
    TData extends PutEndpoints[Path]["response"],
    TError = unknown
  >(
    path: Path,
    options?: Omit<
      UseMutationOptions<TData, TError, TVariables>,
      "mutationKey" | "mutationFn"
    >
  ): UseMutationResult<TData, TError, TVariables> & {
    mutationKey: MutationKey;
  } {
    const mutationKey = this.getCacheKey("put", path, {} as never);

    return Object.assign(
      useMutation({
        mutationFn: (params: TVariables) =>
          this.#client.put(path, params as never),
        mutationKey,
        ...(options as {}),
      }),
      { mutationKey }
    ) as never;
  }
}

export function createRiseApiHooks(client: RiseApiClient) {
  return new RiseApiHooks(client);
}
