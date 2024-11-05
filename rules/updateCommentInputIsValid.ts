import { rule } from "graphql-shield";
import { CommentUpdateInput } from "../src/generated/graphql.js";
import { MAX_CHARS_IN_COMMENT_TEXT } from "./constants.js";

type Input = {
    update: CommentUpdateInput;
}

export const updateCommentInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: Input, ctx: any, info: any) => {
    if (!args?.update) {
      return "Missing update input in args.";
    }
    const { text } = args.update;

    if (!text) {
      return "Comment text is required.";
    }

    if (text.length > MAX_CHARS_IN_COMMENT_TEXT) {
      return `The comment text cannot exceed ${MAX_CHARS_IN_COMMENT_TEXT} characters.`;
    }
    return true;
  }
);
