import { rule } from "graphql-shield";
import { CanCreateDiscussionArgs } from "./rules";
import { MAX_CHARS_IN_DISCUSSION_BODY } from "./updateDiscussionInputIsValid";

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

    if (body && body.length > MAX_CHARS_IN_DISCUSSION_BODY) {
      return "The discussion body cannot exceed 18,000 characters.";
    }

    return true;
  }
);
