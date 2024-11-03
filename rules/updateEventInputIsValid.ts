import { rule } from "graphql-shield";
import { CanUpdateEventArgs } from "./rules";
import { MAX_CHARS_IN_EVENT_DESCRIPTION, MAX_CHARS_IN_EVENT_TITLE } from "./constants.js";

export const updateDiscussionInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: CanUpdateEventArgs, ctx: any, info: any) => {
    if (!args.eventCreateInput) {
      return "Missing eventCreateInput in args.";
    }

    const { eventCreateInput } = args;
    const { title, description } = eventCreateInput;

    if (!title) {
      return "A title is required.";
    }

    if (title && title.length > MAX_CHARS_IN_EVENT_TITLE) {
      return `The event title cannot exceed ${MAX_CHARS_IN_EVENT_TITLE} characters.`;
    }

    if (description && description.length > MAX_CHARS_IN_EVENT_DESCRIPTION) {
      return `The event body cannot exceed ${MAX_CHARS_IN_EVENT_DESCRIPTION} characters.`;
    }

    return true;
  }
);
