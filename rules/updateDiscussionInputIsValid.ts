import { rule } from "graphql-shield";
import { CanUpdateDiscussionArgs } from "./rules";

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

    if (body && body.length > 100) {
      return "The discussion body cannot exceed 100 characters.";
    }

    return true;
  }
);
