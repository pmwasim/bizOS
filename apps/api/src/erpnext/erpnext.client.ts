export interface ErpnextConnection {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

export type FetchLike = typeof fetch;

export class ErpnextNotConfiguredError extends Error {
  constructor() {
    super("ERPNext integration is not configured.");
  }
}

export class ErpnextRequestError extends Error {
  constructor(readonly status: number) {
    super(`ERPNext request failed with status ${status}.`);
  }
}

export class ErpnextClient {
  constructor(
    private readonly connection: ErpnextConnection | undefined,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  isConfigured(): boolean {
    return this.connection !== undefined;
  }

  async getAuthenticatedUser(): Promise<string> {
    const connection = this.requireConnection();
    const response = await this.fetcher(
      new URL("/api/method/frappe.auth.get_logged_user", connection.baseUrl),
      {
        headers: {
          Accept: "application/json",
          Authorization: `token ${connection.apiKey}:${connection.apiSecret}`,
        },
        method: "GET",
      },
    );

    if (!response.ok) {
      throw new ErpnextRequestError(response.status);
    }

    const body: unknown = await response.json();
    if (!isAuthenticatedUserResponse(body)) {
      throw new ErpnextRequestError(response.status);
    }

    return body.message;
  }

  async createDocument(
    docType: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const connection = this.requireConnection();
    const response = await this.fetcher(
      new URL(`/api/resource/${encodeURIComponent(docType)}`, connection.baseUrl),
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `token ${connection.apiKey}:${connection.apiSecret}`,
        },
        method: "POST",
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      throw new ErpnextRequestError(response.status);
    }

    const body: unknown = await response.json();
    return (body as { data: Record<string, unknown> }).data;
  }

  async getDocument(docType: string, name: string): Promise<Record<string, unknown>> {
    const connection = this.requireConnection();
    const response = await this.fetcher(
      new URL(
        `/api/resource/${encodeURIComponent(docType)}/${encodeURIComponent(name)}`,
        connection.baseUrl,
      ),
      {
        headers: {
          Accept: "application/json",
          Authorization: `token ${connection.apiKey}:${connection.apiSecret}`,
        },
        method: "GET",
      },
    );

    if (!response.ok) {
      throw new ErpnextRequestError(response.status);
    }

    const body: unknown = await response.json();
    return (body as { data: Record<string, unknown> }).data;
  }

  async updateDocument(
    docType: string,
    name: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const connection = this.requireConnection();
    const response = await this.fetcher(
      new URL(
        `/api/resource/${encodeURIComponent(docType)}/${encodeURIComponent(name)}`,
        connection.baseUrl,
      ),
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `token ${connection.apiKey}:${connection.apiSecret}`,
        },
        method: "PUT",
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      throw new ErpnextRequestError(response.status);
    }

    const body: unknown = await response.json();
    return (body as { data: Record<string, unknown> }).data;
  }

  private requireConnection(): ErpnextConnection {
    if (!this.connection) {
      throw new ErpnextNotConfiguredError();
    }

    return this.connection;
  }
}

function isAuthenticatedUserResponse(value: unknown): value is { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  );
}
