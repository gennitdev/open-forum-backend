import { rule } from "graphql-shield";
import { CanCreateDiscussionArgs } from "./rules";
import { MAX_CHARS_IN_DISCUSSION_BODY, MAX_CHARS_IN_DISCUSSION_TITLE } from "./updateDiscussionInputIsValid";

export const createDiscussionInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: CanCreateDiscussionArgs, ctx: any, info: any) => {
    if (!args.discussionCreateInput) {
      return "Missing discussionCreateInput in args.";
    }

    const { discussionCreateInput } = args;
    const { title, body } = discussionCreateInput;

    if (!title) {
      return "A title is required.";
    }

    if (title && title.length > MAX_CHARS_IN_DISCUSSION_TITLE) {
        return `The discussion title cannot exceed ${MAX_CHARS_IN_DISCUSSION_TITLE} characters.`;
      }

    if (body && body.length > MAX_CHARS_IN_DISCUSSION_BODY) {
      return "The discussion body cannot exceed 18,000 characters.";
    }

    return true;
  }
);
