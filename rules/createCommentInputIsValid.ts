import { rule } from "graphql-shield";
import { CommentCreateInput } from "../src/generated/graphql.js";
import { MAX_CHARS_IN_COMMENT_TEXT } from "./constants.js";

type Input = { input: CommentCreateInput[] };

export const createCommentInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: Input, ctx: any, info: any) => {
    if (!args.input) {
      return "Missing input in args.";
    }

    const { input } = args;
    const commentData = input[0];
    if (!commentData) {
      return "No comment create input found.";
    }
    const { text } = commentData;

    if (!text) {
      return "Comment text is required.";
    }

    if (text.length > MAX_CHARS_IN_COMMENT_TEXT) {
      return `The comment text cannot exceed ${MAX_CHARS_IN_COMMENT_TEXT} characters.`;
    }
    return true;
  }
);
