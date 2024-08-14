import { Static, StaticDecode, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  MutationKey,
  QueryFunctionContext,
  QueryKey,
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
  useMutation,
  UseMutationOptions,
  UseMutationResult,
  useQueries,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  UseQueryResult,
} from "react-query";

import type {
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

  constructor(public fetcher: Fetcher, enableParsing = true) {
    this.#enabledParsing = enableParsing;
  }

  setBaseUrl(baseUrl: string) {
    this.#baseUrl = baseUrl;
    return this;
  }

  parse<T extends TSchema>(schema: T, value: unknown): StaticDecode<T, []> {
    return this.#enabledParsing ? Value.Parse(schema, value) : value;
  }

  parseAsync<T extends TSchema>(
    schema: T,
    value: Promise<unknown>
  ): Promise<StaticDecode<T, []>> {
    return value.then((res) => this.parse(schema, res));
  }

  post<Path extends keyof PostEndpoints, TEndpoint extends PostEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<Static<TEndpoint>["parameters"]>
  ): Promise<Static<TEndpoint>["response"]> {
    const PostSchema = EndpointByMethod.post[path].properties;

    return this.parseAsync(
      PostSchema.response,
      this.fetcher(
        "post",
        this.#baseUrl + path,
        this.parse(PostSchema.parameters, params[0])
      )
    );
  }

  get<Path extends keyof GetEndpoints, TEndpoint extends GetEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<Static<TEndpoint>["parameters"]>
  ): Promise<Static<TEndpoint>["response"]> {
    const GetSchema = EndpointByMethod.get[path].properties;

    return this.parseAsync(
      GetSchema.response,
      this.fetcher(
        "get",
        this.#baseUrl + path,
        this.parse(GetSchema.parameters, params[0])
      )
    );
  }

  patch<
    Path extends keyof PatchEndpoints,
    TEndpoint extends PatchEndpoints[Path]
  >(
    path: Path,
    ...params: MaybeOptionalArg<Static<TEndpoint>["parameters"]>
  ): Promise<Static<TEndpoint>["response"]> {
    const PatchSchema = EndpointByMethod.patch[path].properties;

    return this.parseAsync(
      PatchSchema.response,
      this.fetcher(
        "patch",
        this.#baseUrl + path,
        this.parse(PatchSchema.parameters, params[0])
      )
    );
  }
  delete<
    Path extends keyof DeleteEndpoints,
    TEndpoint extends DeleteEndpoints[Path]
  >(
    path: Path,
    ...params: MaybeOptionalArg<Static<TEndpoint>["parameters"]>
  ): Promise<Static<TEndpoint>["response"]> {
    const PatchSchema = EndpointByMethod.delete[path].properties;

    return this.parseAsync(
      PatchSchema.response,
      this.fetcher(
        "delete",
        this.#baseUrl + path,
        this.parse(PatchSchema.parameters, params[0])
      )
    );
  }
}

export function createRiseApiClient(
  fetcher: Fetcher,
  baseUrl?: string,
  enableParsing?: boolean
) {
  return new RiseApiClient(fetcher, enableParsing).setBaseUrl(baseUrl ?? "");
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

  public useGet<
    Path extends keyof GetEndpoints,
    TEndpoint extends GetEndpoints[Path],
    TData extends Static<TEndpoint>["response"],
    TError = unknown
  >(
    path: Path,
    ...rest: MaybeOptionalOptions<
      Static<TEndpoint>["parameters"],
      Omit<UseQueryOptions<TData, TError>, "queryKey" | "queryFn">
    >
  ): UseQueryResult<TData, Error> & {
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

  public useInfiniteGet<
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
  ): UseInfiniteQueryResult<TData, Error> & {
    invalidate: () => Promise<void>;
    queryKey: QueryKey;
  } {
    const queryClient = useQueryClient();
    const queryKey = this.getCacheKey("get", path, undefined as never);
    const queryFn = async (context: QueryFunctionContext<QueryKey>) => {
      const config = configMapper(context);
      return this.#client.get(path, config as never);
    };
    const invalidate = () => queryClient.invalidateQueries(queryKey);

    return {
      ...useInfiniteQuery({
        queryFn,
        queryKey: queryKey,
        ...(options as {}),
      }),
      invalidate,
      queryKey,
    } as never;
  }

  public usePost<
    Path extends keyof PostEndpoints,
    TEndpoint extends PostEndpoints[Path],
    TData extends Static<TEndpoint>["response"],
    TError = unknown
  >(
    path: Path,
    ...rest: MaybeOptionalOptions<
      Static<TEndpoint>["parameters"],
      Omit<UseMutationOptions<TData, TError>, "mutationKey" | "mutationFn">
    >
  ): UseMutationResult<TData, Error> & {
    mutationKey: MutationKey;
  } {
    const [config, options] = rest;
    const mutationKey = this.getCacheKey("post", path, config as never);

    return {
      ...useMutation({
        mutationFn: () => this.#client.post(path, config as never),
        mutationKey,
        ...(options as {}),
      }),
      mutationKey,
    } as never;
  }

  public usePatch<
    Path extends keyof PatchEndpoints,
    TEndpoint extends PatchEndpoints[Path],
    TData extends Static<TEndpoint>["response"],
    TError = unknown
  >(
    path: Path,
    ...rest: MaybeOptionalOptions<
      Static<TEndpoint>["parameters"],
      Omit<UseMutationOptions<TData, TError>, "mutationKey" | "mutationFn">
    >
  ): UseMutationResult<TData, Error> & {
    mutationKey: MutationKey;
  } {
    const [config, options] = rest;
    const mutationKey = this.getCacheKey("patch", path, config as never);

    return {
      ...useMutation({
        mutationFn: () => this.#client.patch(path, config as never),
        mutationKey,
        ...(options as {}),
      }),
      mutationKey,
    } as never;
  }

  public useDelete<
    Path extends keyof DeleteEndpoints,
    TEndpoint extends DeleteEndpoints[Path],
    TData extends Static<TEndpoint>["response"],
    TError = unknown
  >(
    path: Path,
    ...rest: MaybeOptionalOptions<
      Static<TEndpoint>["parameters"],
      Omit<UseMutationOptions<TData, TError>, "mutationKey" | "mutationFn">
    >
  ): UseMutationResult<TData, Error> & {
    mutationKey: MutationKey;
  } {
    const [config, options] = rest;
    const mutationKey = this.getCacheKey("delete", path, config as never);

    return {
      ...useMutation({
        mutationFn: () => this.#client.delete(path, config as never),
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
