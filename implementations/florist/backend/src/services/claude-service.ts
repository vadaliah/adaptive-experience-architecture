import {
  BedrockRuntimeClient,
  ConverseCommand
} from "@aws-sdk/client-bedrock-runtime";


export interface ClaudeInvokeResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs: number;
}


export interface ClaudeToolResult {
  stopReason?: string;

  text?: string;

  toolName?: string;

  toolUseId?: string;

  toolInput?: unknown;

  inputTokens?: number;

  outputTokens?: number;

  totalTokens?: number;

  latencyMs: number;
}


export class ClaudeService {

  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;


  constructor() {

    const region = process.env.AWS_REGION;
    const modelId = process.env.BEDROCK_MODEL_ID;

    if (!region) {
      throw new Error(
        "AWS_REGION environment variable is required."
      );
    }

    if (!modelId) {
      throw new Error(
        "BEDROCK_MODEL_ID environment variable is required."
      );
    }

    this.modelId = modelId;

    this.client = new BedrockRuntimeClient({
      region
    });
  }


  /**
   * Standard Claude invocation.
   *
   * Used when we simply want to send a prompt to Claude
   * and receive a text response.
   */
  async invoke(
    message: string
  ): Promise<ClaudeInvokeResult> {

    const start = Date.now();

    const command = new ConverseCommand({
      modelId: this.modelId,

      messages: [
        {
          role: "user",
          content: [
            {
              text: message
            }
          ]
        }
      ]
    });

    const response =
      await this.client.send(command);

    const content =
      response.output?.message?.content ?? [];

    const textBlock =
      content.find(
        (item) => "text" in item
      );

    const text =
      textBlock && "text" in textBlock
        ? textBlock.text ?? ""
        : "";

    return {
      text,

      inputTokens:
        response.usage?.inputTokens,

      outputTokens:
        response.usage?.outputTokens,

      totalTokens:
        response.usage?.totalTokens,

      latencyMs:
        Date.now() - start
    };
  }


  /**
   * Claude invocation with agent tools.
   *
   * Claude receives the user's message plus the
   * available tool definitions.
   *
   * Claude may either:
   *
   * 1. Return normal text
   *
   * OR
   *
   * 2. Request execution of one of our registered tools.
   *
   * This method DOES NOT execute the tool.
   * It only reports Claude's decision.
   */
  async invokeWithTools(
    message: string,
    tools: any[]
  ): Promise<ClaudeToolResult> {

    const start = Date.now();

    const command = new ConverseCommand({
      modelId: this.modelId,

      messages: [
        {
          role: "user",
          content: [
            {
              text: message
            }
          ]
        }
      ],

      toolConfig: {
        tools
      }
    });

    const response =
      await this.client.send(command);

    const content =
      response.output?.message?.content ?? [];

    /*
     * Claude may return a normal text block.
     */
    const textBlock =
      content.find(
        (item) => "text" in item
      );

    /*
     * Or Claude may request that our application
     * execute one of the available tools.
     */
    const toolBlock =
      content.find(
        (item) => "toolUse" in item
      );

    return {
      stopReason:
        response.stopReason,

      text:
        textBlock && "text" in textBlock
          ? textBlock.text
          : undefined,

      toolName:
        toolBlock && "toolUse" in toolBlock
          ? toolBlock.toolUse?.name
          : undefined,

      toolUseId:
        toolBlock && "toolUse" in toolBlock
          ? toolBlock.toolUse?.toolUseId
          : undefined,

      toolInput:
        toolBlock && "toolUse" in toolBlock
          ? toolBlock.toolUse?.input
          : undefined,

      inputTokens:
        response.usage?.inputTokens,

      outputTokens:
        response.usage?.outputTokens,

      totalTokens:
        response.usage?.totalTokens,

      latencyMs:
        Date.now() - start
    };
  }
}