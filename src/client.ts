import { Static, StaticDecode, TAny, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  FetchQueryOptions,
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
} from "react-query";

import type {
  EndpointMethodMap,
  Fetcher,
  HttpMethod,
  MaybeOptionalArg,
  MaybeOptionalOptions,
} from "./client.types.js";
import {
  DeleteEndpoints,
  EndpointByMethod,
  GetEndpoints,
  PatchEndpoints,
  PostEndpoints,
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

  #request<M extends HttpMethod, P extends keyof EndpointMethodMap[M]>(
    method: M,
    path: P,
    ...params: any[]
  ): Promise<any> {
    const parameters = params[0];
    const finalPath = this.#constructPath(path as string, parameters?.path);
    const EndpointSchema = (EndpointByMethod[method][path] as TAny).properties;

    return this.#parseAsync(
      EndpointSchema.response,
      this.fetcher(
        method,
        this.#baseUrl + finalPath,
        this.#parse(EndpointSchema.parameters as TAny, parameters)
      )
    );
  }

  get<Path extends keyof GetEndpoints, TEndpoint extends GetEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<Static<TEndpoint>["parameters"]>
  ): Promise<Static<TEndpoint>["response"]> {
    return this.#request("get", path, ...params);
  }

  post<Path extends keyof PostEndpoints, TEndpoint extends PostEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<Static<TEndpoint>["parameters"]>
  ): Promise<Static<TEndpoint>["response"]> {
    return this.#request("post", path, ...params);
  }

  patch<
    Path extends keyof PatchEndpoints,
    TEndpoint extends PatchEndpoints[Path]
  >(
    path: Path,
    ...params: MaybeOptionalArg<Static<TEndpoint>["parameters"]>
  ): Promise<Static<TEndpoint>["response"]> {
    return this.#request("patch", path, ...params);
  }

  delete<
    Path extends keyof DeleteEndpoints,
    TEndpoint extends DeleteEndpoints[Path]
  >(
    path: Path,
    ...params: MaybeOptionalArg<Static<TEndpoint>["parameters"]>
  ): Promise<Static<TEndpoint>["response"]> {
    return this.#request("delete", path, ...params);
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
    Endpoint extends EndpointByMethod[Method],
    Path extends keyof Endpoint,
    TEndpoint extends Endpoint[Path]
  >(
    method: Method,
    path: Path,
    //   @ts-expect-error cannot seem to index with parameters
    ...params: MaybeOptionalArg<Static<TEndpoint>["parameters"]>
  ): readonly [string, ...unknown[]] {
    const key = `${method}_${path as string}`;
    return [key, ...params];
  }

  setCachedData<
    Method extends HttpMethod,
    Endpoint extends EndpointByMethod[Method],
    Path extends keyof Endpoint,
    TEndpoint extends Endpoint[Path]
  >(
    queryClient: QueryClient,
    method: Method,
    path: Path,
    ...options: MaybeOptionalOptions<
      // @ts-expect-error cannot seem to index with response
      Static<TEndpoint>["response"],
      // @ts-expect-error cannot seem to index with parameters
      Static<TEndpoint>["parameters"]
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
    Endpoint extends EndpointByMethod[Method],
    Path extends keyof Endpoint,
    TEndpoint extends Endpoint[Path]
  >(
    method: Method,
    path: Path,
    ...options: MaybeOptionalOptions<
      // @ts-expect-error cannot seem to index with response
      Static<TEndpoint>["response"],
      // @ts-expect-error cannot seem to index with parameters
      Static<TEndpoint>["parameters"]
    >
  ): void {
    const queryClient = useQueryClient();

    this.setCachedData(queryClient, method, path as any, ...options);
  }

  getCachedData<
    Method extends HttpMethod,
    Endpoint extends EndpointByMethod[Method],
    Path extends keyof Endpoint,
    TEndpoint extends Endpoint[Path]
  >(
    queryClient: QueryClient,
    method: Method,
    path: Path,
    //   @ts-expect-error cannot seem to index with parameters
    ...params: MaybeOptionalArg<Static<TEndpoint>["parameters"]>
  ): //   @ts-expect-error cannot seem to index with response
  Static<TEndpoint>["response"] | undefined {
    const queryKey = this.getCacheKey(method, path as any, ...params);

    return queryClient.getQueryData(queryKey);
  }

  useGetCachedData<
    Method extends HttpMethod,
    Endpoint extends EndpointByMethod[Method],
    Path extends keyof Endpoint,
    TEndpoint extends Endpoint[Path]
  >(
    method: Method,
    path: Path,
    //   @ts-expect-error cannot seem to index with parameters
    ...params: MaybeOptionalArg<Static<TEndpoint>["parameters"]>
  ): //   @ts-expect-error cannot seem to index with parameters
  Static<TEndpoint>["response"] | undefined {
    const queryClient = useQueryClient();

    return this.getCachedData(queryClient, method, path as any, ...params);
  }

  prefetchData<
    Path extends keyof GetEndpoints,
    TEndpoint extends GetEndpoints[Path]
  >(
    queryClient: QueryClient,
    path: Path,
    ...rest: MaybeOptionalOptions<
      Static<TEndpoint>["parameters"],
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

  usePrefetchData<
    Path extends keyof GetEndpoints,
    TEndpoint extends GetEndpoints[Path]
  >(
    path: Path,
    ...rest: MaybeOptionalOptions<
      Static<TEndpoint>["parameters"],
      FetchQueryOptions
    >
  ) {
    const queryClient = useQueryClient();

    this.prefetchData(queryClient, path, ...rest);
  }

  useGet<
    Path extends keyof GetEndpoints,
    TEndpoint extends GetEndpoints[Path],
    TQueryFnData extends Static<TEndpoint>["response"],
    TError = unknown,
    TData = TQueryFnData
  >(
    path: Path,
    ...rest: MaybeOptionalOptions<
      Static<TEndpoint>["parameters"],
      Omit<UseQueryOptions<TQueryFnData, TError, TData>, "queryKey" | "queryFn">
    >
  ): UseQueryResult<TData, TError> & {
    invalidate: () => Promise<void>;
    queryKey: QueryKey;
  } {
    const queryClient = useQueryClient();
    const [config, options] = rest;
    const queryKey = this.getCacheKey("get", path, config as never);
    const invalidate = () => queryClient.invalidateQueries(queryKey);

    return {
      ...useQuery({
        queryFn: () => this.#client.get(path, config as never),
        queryKey,
        ...(options as {}),
      }),
      invalidate,
      queryKey,
    };
  }

  useInfiniteGet<
    Path extends keyof GetEndpoints,
    TEndpoint extends GetEndpoints[Path],
    TData extends Static<TEndpoint>["response"],
    TError = unknown
  >(
    path: Path,
    configMapper: (
      context: QueryFunctionContext<QueryKey>
    ) => Static<TEndpoint>["parameters"],
    options?: Omit<
      UseInfiniteQueryOptions<TData, TError>,
      "queryKey" | "queryFn"
    >
  ): UseInfiniteQueryResult<TData, TError> & {
    invalidate: () => Promise<void>;
    queryKey: QueryKey;
  } {
    const queryClient = useQueryClient();
    const queryKey = this.getCacheKey(
      "get",
      path,
      configMapper({ meta: {}, queryKey: [] })
    );
    const queryFn = (context: QueryFunctionContext<QueryKey>) => {
      const config = configMapper(context);
      return this.#client.get(path, config as never);
    };
    const invalidate = () => queryClient.invalidateQueries(queryKey);

    return {
      ...useInfiniteQuery({
        queryFn,
        queryKey,
        ...(options as {}),
      }),
      invalidate,
      queryKey,
    } as never;
  }

  usePost<
    Path extends keyof PostEndpoints,
    TEndpoint extends PostEndpoints[Path],
    TVariables extends Static<TEndpoint>["parameters"],
    TData extends Static<TEndpoint>["response"],
    TError = unknown
  >(
    path: Path,
    options?: Omit<
      UseMutationOptions<TData, TError>,
      "mutationKey" | "mutationFn"
    >
  ): UseMutationResult<TData, TError, TVariables> & {
    mutationKey: MutationKey;
  } {
    const mutationKey = this.getCacheKey("post", path, {} as never);

    return {
      ...useMutation({
        mutationFn: (params: Static<TEndpoint>["parameters"]) =>
          this.#client.post(path, params as never),
        mutationKey,
        ...(options as {}),
      }),
      mutationKey,
    } as never;
  }

  usePatch<
    Path extends keyof PatchEndpoints,
    TEndpoint extends PatchEndpoints[Path],
    TVariables extends Static<TEndpoint>["parameters"],
    TData extends Static<TEndpoint>["response"],
    TError = unknown
  >(
    path: Path,
    options?: Omit<
      UseMutationOptions<TData, TError>,
      "mutationKey" | "mutationFn"
    >
  ): UseMutationResult<TData, TError, TVariables> & {
    mutationKey: MutationKey;
  } {
    const mutationKey = this.getCacheKey("patch", path, {} as never);

    return {
      ...useMutation({
        mutationFn: (params: TVariables) =>
          this.#client.patch(path, params as never),
        mutationKey,
        ...(options as {}),
      }),
      mutationKey,
    } as never;
  }

  useDelete<
    Path extends keyof DeleteEndpoints,
    TEndpoint extends DeleteEndpoints[Path],
    TVariables extends Static<TEndpoint>["parameters"],
    TData extends Static<TEndpoint>["response"],
    TError = unknown
  >(
    path: Path,
    options?: Omit<
      UseMutationOptions<TData, TError>,
      "mutationKey" | "mutationFn"
    >
  ): UseMutationResult<TData, TError, TVariables> & {
    mutationKey: MutationKey;
  } {
    const mutationKey = this.getCacheKey("delete", path, {} as never);

    return {
      ...useMutation({
        mutationFn: (params: TVariables) =>
          this.#client.delete(path, params as never),
        mutationKey,
        ...(options as {}),
      }),
      mutationKey,
    } as never;
  }
}

export function createRiseApiHooks(client: RiseApiClient) {
  return new RiseApiHooks(client);
}
