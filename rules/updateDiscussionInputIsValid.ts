import { rule } from "graphql-shield";
import { CanUpdateDiscussionArgs } from "./rules";
import { MAX_CHARS_IN_DISCUSSION_BODY, MAX_CHARS_IN_DISCUSSION_TITLE } from "./constants.js";

export const updateDiscussionInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: CanUpdateDiscussionArgs, ctx: any, info: any) => {
    if (!args.discussionUpdateInput) {
      return "Missing discussionUpdateInput in args.";
    }

    const { discussionUpdateInput } = args;
    const { title, body } = discussionUpdateInput;

    if (!title) {
      return "A title is required.";
    }

    if (title && title.length > MAX_CHARS_IN_DISCUSSION_TITLE) {
      return `The discussion title cannot exceed ${MAX_CHARS_IN_DISCUSSION_TITLE} characters.`;
    }

    if (body && body.length > MAX_CHARS_IN_DISCUSSION_BODY) {
      return `The discussion body cannot exceed ${MAX_CHARS_IN_DISCUSSION_BODY} characters.`;
    }

    return true;
  }
);
