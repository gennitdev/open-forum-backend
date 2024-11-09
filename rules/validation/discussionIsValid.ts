import { rule } from "graphql-shield";
import { CanCreateDiscussionArgs, CanUpdateDiscussionArgs } from "../rules";
import { MAX_CHARS_IN_DISCUSSION_BODY, MAX_CHARS_IN_DISCUSSION_TITLE } from "./constants.js";

type DiscussionInput = { title?: string; body?: string | null };

const validateDiscussionInput = (input: DiscussionInput): true | string => {
  const { title, body } = input;

  if (!title) {
    return "A title is required.";
  }

  if (title.length > MAX_CHARS_IN_DISCUSSION_TITLE) {
    return `The discussion title cannot exceed ${MAX_CHARS_IN_DISCUSSION_TITLE} characters.`;
  }

  if (body && body.length > MAX_CHARS_IN_DISCUSSION_BODY) {
    return `The discussion body cannot exceed ${MAX_CHARS_IN_DISCUSSION_BODY} characters.`;
  }

  return true;
};

export const createDiscussionInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: CanCreateDiscussionArgs, ctx: any, info: any) => {
    if (!args.discussionCreateInput) {
      return "Missing discussionCreateInput in args.";
    }
    return validateDiscussionInput(args.discussionCreateInput);
  }
);

export const updateDiscussionInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: CanUpdateDiscussionArgs, ctx: any, info: any) => {
    if (!args.discussionUpdateInput) {
      return "Missing discussionUpdateInput in args.";
    }
    return validateDiscussionInput(args.discussionUpdateInput);
  }
);
