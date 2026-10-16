import { HealthResponse } from "@foresight/shared";
import type { LambdaContext } from "hono/aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { handler } from "./lambda.js";

vi.hoisted(() => {
  process.env.EVENTS_TABLE_NAME = "test-events";
  process.env.THESES_TABLE_NAME = "test-theses";
  process.env.USER_POOL_ID = "eu-central-1_test";
  process.env.USER_POOL_CLIENT_ID = "test-client";
  process.env.AUTH_DOMAIN = "https://login.example.com";
});

// Zdarzenie Function URL (payload 2.0) — tak CloudFront przez OAC woła Lambdę.
function functionUrlEvent(method: string, path: string) {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: path,
    rawQueryString: "",
    headers: { host: "example.lambda-url.eu-central-1.on.aws" },
    isBase64Encoded: false,
    body: null,
    requestContext: {
      accountId: "anonymous",
      apiId: "example",
      authentication: null,
      authorizer: {},
      domainName: "example.lambda-url.eu-central-1.on.aws",
      domainPrefix: "example",
      http: {
        method,
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "test",
      routeKey: "$default",
      stage: "$default",
      time: "12/Oct/2026:14:00:00 +0000",
      timeEpoch: 0,
    },
  };
}

describe("Lambda handler", () => {
  it("answers GET /api/health from a Function URL event", async () => {
    const result = await handler(functionUrlEvent("GET", "/api/health"), {} as LambdaContext);

    expect(result.statusCode).toBe(200);
    expect(HealthResponse.parse(JSON.parse(result.body))).toEqual({ status: "ok" });
  });
});
