import { rule } from "graphql-shield";
import { ChannelCreateInput, ChannelUpdateInput } from "../src/generated/graphql.js";
import { MAX_CHARS_IN_CHANNEL_NAME, MAX_CHARS_IN_DISPLAY_NAME, MAX_CHARS_IN_CHANNEL_DESCRIPTION } from "./constants.js";

type ChannelInput = { 
  uniqueName?: string | null; 
  description?: string | null;
  displayName?: string | null;
};

const validateChannelInput = (input: ChannelInput): true | string => {
  const { uniqueName, description, displayName } = input;

  if (!uniqueName) {
    return "A unique name is required.";
  }

  if (uniqueName.length > MAX_CHARS_IN_CHANNEL_NAME) {
    return `The unique name cannot exceed ${MAX_CHARS_IN_CHANNEL_NAME} characters.`;
  }

  // Allow only letters, numbers, and underscores in uniqueName; no spaces or special characters.
  if (!/^[a-zA-Z0-9_]+$/.test(uniqueName)) {
    return "The unique name can only contain letters, numbers, and underscores and cannot contain spaces or special characters.";
  }

  if (description && description.length > MAX_CHARS_IN_CHANNEL_DESCRIPTION) {
    return `The description text cannot exceed ${MAX_CHARS_IN_CHANNEL_DESCRIPTION} characters.`;
  }

  if (displayName && displayName.length > MAX_CHARS_IN_DISPLAY_NAME) {
    return `The display name cannot exceed ${MAX_CHARS_IN_DISPLAY_NAME} characters.`;
  }

  return true;
};

type CreateChannelInput = { input: ChannelCreateInput[] };
export const createChannelInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: CreateChannelInput, ctx: any, info: any) => {
    if (!args.input || !args.input[0]) {
      return "Missing or empty input in args.";
    }
    return validateChannelInput(args.input[0]);
  }
);

type UpdateChannelInput = { update: ChannelUpdateInput };
export const updateChannelInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: UpdateChannelInput, ctx: any, info: any) => {
    if (!args.update) {
      return "Missing update input in args.";
    }
    return validateChannelInput(args.update);
  }
);
