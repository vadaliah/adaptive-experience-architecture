import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";


/*
 * Amazon Bedrock is fully mocked. These tests cover request
 * construction and response parsing only. They make no
 * assertions about Claude's semantic or tool-selection behavior.
 */
const { send, BedrockRuntimeClient, ConverseCommand } = vi.hoisted(() => {
  const send = vi.fn();

  const BedrockRuntimeClient = vi.fn(function (this: any) {
    this.send = send;
  });

  const ConverseCommand = vi.fn(function (this: any, input: unknown) {
    this.input = input;
  });

  return { send, BedrockRuntimeClient, ConverseCommand };
});

vi.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient,
  ConverseCommand
}));


import { ClaudeService } from "../../../src/services/claude-service.js";


const MODEL_ID = "test.model-id";

const USAGE = {
  inputTokens: 11,
  outputTokens: 22,
  totalTokens: 33
};


/**
 * Resolves the given Converse response after advancing the
 * fake clock, so latencyMs is deterministic.
 */
function respondWith(response: unknown, elapsedMs = 250): void {
  send.mockImplementation(async () => {
    vi.advanceTimersByTime(elapsedMs);
    return response;
  });
}


function sentCommandInput(): any {
  expect(send).toHaveBeenCalledTimes(1);
  return send.mock.calls[0]![0].input;
}


beforeEach(() => {
  send.mockReset();
  BedrockRuntimeClient.mockClear();
  ConverseCommand.mockClear();

  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

  vi.stubEnv("AWS_REGION", "us-test-1");
  vi.stubEnv("BEDROCK_MODEL_ID", MODEL_ID);
});

afterEach(() => {
  vi.useRealTimers();
});


describe("ClaudeService constructor", () => {

  it("throws when AWS_REGION is missing", () => {
    vi.stubEnv("AWS_REGION", undefined);

    expect(() => new ClaudeService()).toThrow(
      "AWS_REGION environment variable is required."
    );

    expect(BedrockRuntimeClient).not.toHaveBeenCalled();
  });


  it("throws when BEDROCK_MODEL_ID is missing", () => {
    vi.stubEnv("BEDROCK_MODEL_ID", undefined);

    expect(() => new ClaudeService()).toThrow(
      "BEDROCK_MODEL_ID environment variable is required."
    );

    expect(BedrockRuntimeClient).not.toHaveBeenCalled();
  });


  it("creates a Bedrock client for the configured region", () => {
    new ClaudeService();

    expect(BedrockRuntimeClient).toHaveBeenCalledTimes(1);
    expect(BedrockRuntimeClient).toHaveBeenCalledWith({
      region: "us-test-1"
    });
  });
});


describe("ClaudeService.invoke", () => {

  it("sends a single user message to the configured model", async () => {
    respondWith({ output: { message: { content: [] } } });

    await new ClaudeService().invoke("Hello");

    expect(sentCommandInput()).toEqual({
      modelId: MODEL_ID,
      messages: [
        {
          role: "user",
          content: [{ text: "Hello" }]
        }
      ]
    });
  });


  it("returns the first text block, token usage and latency", async () => {
    respondWith(
      {
        output: {
          message: {
            content: [
              { text: "first" },
              { text: "second" }
            ]
          }
        },
        usage: USAGE
      },
      250
    );

    const result = await new ClaudeService().invoke("Hello");

    expect(result).toEqual({
      text: "first",
      ...USAGE,
      latencyMs: 250
    });
  });


  it("returns empty text when the response has no content", async () => {
    respondWith({}, 0);

    const result = await new ClaudeService().invoke("Hello");

    expect(result).toEqual({
      text: "",
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
      latencyMs: 0
    });
  });


  it("returns empty text when the content has no text block", async () => {
    respondWith({
      output: {
        message: {
          content: [{ toolUse: { name: "x", toolUseId: "1", input: {} } }]
        }
      }
    });

    const result = await new ClaudeService().invoke("Hello");

    expect(result.text).toBe("");
  });


  it("propagates Bedrock client errors", async () => {
    send.mockRejectedValue(new Error("throttled"));

    await expect(
      new ClaudeService().invoke("Hello")
    ).rejects.toThrow("throttled");
  });
});


describe("ClaudeService.invokeWithTools", () => {

  const tools = [
    { toolSpec: { name: "alpha", description: "A", inputSchema: { json: {} } } }
  ];


  it("sends the user message and tool configuration", async () => {
    respondWith({ output: { message: { content: [] } } });

    await new ClaudeService().invokeWithTools("Find flowers", tools);

    const input = sentCommandInput();

    expect(input).toEqual({
      modelId: MODEL_ID,
      messages: [
        {
          role: "user",
          content: [{ text: "Find flowers" }]
        }
      ],
      toolConfig: {
        tools
      }
    });

    expect(input.toolConfig.tools).toBe(tools);
  });


  it("parses a tool-use block into the tool decision", async () => {
    const toolInput = {
      request: { returnAllProducts: true },
      metadata: { title: "Catalog", qualifiers: [] }
    };

    respondWith(
      {
        stopReason: "tool_use",
        output: {
          message: {
            content: [
              { text: "Let me look that up." },
              {
                toolUse: {
                  name: "alpha",
                  toolUseId: "tooluse-123",
                  input: toolInput
                }
              }
            ]
          }
        },
        usage: USAGE
      },
      400
    );

    const result = await new ClaudeService().invokeWithTools(
      "Find flowers",
      tools
    );

    expect(result).toEqual({
      stopReason: "tool_use",
      text: "Let me look that up.",
      toolName: "alpha",
      toolUseId: "tooluse-123",
      toolInput,
      ...USAGE,
      latencyMs: 400
    });
  });


  it("uses the first tool-use block when several are returned", async () => {
    respondWith({
      output: {
        message: {
          content: [
            { toolUse: { name: "first", toolUseId: "1", input: { a: 1 } } },
            { toolUse: { name: "second", toolUseId: "2", input: { b: 2 } } }
          ]
        }
      }
    });

    const result = await new ClaudeService().invokeWithTools("x", tools);

    expect(result.toolName).toBe("first");
    expect(result.toolUseId).toBe("1");
    expect(result.toolInput).toEqual({ a: 1 });
  });


  it("leaves tool fields undefined for a text-only response", async () => {
    respondWith({
      stopReason: "end_turn",
      output: {
        message: {
          content: [{ text: "Hello there." }]
        }
      }
    });

    const result = await new ClaudeService().invokeWithTools("x", tools);

    expect(result.stopReason).toBe("end_turn");
    expect(result.text).toBe("Hello there.");
    expect(result.toolName).toBeUndefined();
    expect(result.toolUseId).toBeUndefined();
    expect(result.toolInput).toBeUndefined();
  });


  it("leaves text undefined for a tool-only response", async () => {
    respondWith({
      output: {
        message: {
          content: [
            { toolUse: { name: "alpha", toolUseId: "1", input: {} } }
          ]
        }
      }
    });

    const result = await new ClaudeService().invokeWithTools("x", tools);

    expect(result.text).toBeUndefined();
    expect(result.toolName).toBe("alpha");
  });


  it("handles a response with no output", async () => {
    respondWith({}, 0);

    const result = await new ClaudeService().invokeWithTools("x", tools);

    expect(result).toEqual({
      stopReason: undefined,
      text: undefined,
      toolName: undefined,
      toolUseId: undefined,
      toolInput: undefined,
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
      latencyMs: 0
    });
  });


  it("propagates Bedrock client errors", async () => {
    send.mockRejectedValue(new Error("access denied"));

    await expect(
      new ClaudeService().invokeWithTools("x", tools)
    ).rejects.toThrow("access denied");
  });
});
