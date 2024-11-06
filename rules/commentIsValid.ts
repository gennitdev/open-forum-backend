import { rule } from "graphql-shield";
import { CommentCreateInput, CommentUpdateInput } from "../src/generated/graphql.js";
import { MAX_CHARS_IN_COMMENT_TEXT } from "./constants.js";

type CommentInput = { text?: string | null};

const validateCommentText = (input: CommentInput): true | string => {
  const { text } = input;

  if (!text) {
    return "Comment text is required.";
  }

  if (text.length > MAX_CHARS_IN_COMMENT_TEXT) {
    return `The comment text cannot exceed ${MAX_CHARS_IN_COMMENT_TEXT} characters.`;
  }

  return true;
};

type CreateCommentInput = { input: CommentCreateInput[] };
export const createCommentInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: CreateCommentInput, ctx: any, info: any) => {
    if (!args.input || !args.input[0]) {
      return "Missing or empty input in args.";
    }
    return validateCommentText(args.input[0]);
  }
);

type UpdateCommentInput = { update: CommentUpdateInput };
export const updateCommentInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: UpdateCommentInput, ctx: any, info: any) => {
    if (!args.update) {
      return "Missing update input in args.";
    }
    return validateCommentText(args.update);
  }
);
