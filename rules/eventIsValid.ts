import { rule } from "graphql-shield";
import { CanCreateEventArgs, CanUpdateEventArgs } from "./rules";
import { MAX_CHARS_IN_EVENT_DESCRIPTION, MAX_CHARS_IN_EVENT_TITLE } from "./constants.js";

type EventInput = { title?: string; description?: string | null };

const validateEventInput = (input: EventInput): true | string => {
  const { title, description } = input;

  if (!title) {
    return "A title is required.";
  }

  if (title.length > MAX_CHARS_IN_EVENT_TITLE) {
    return `The event title cannot exceed ${MAX_CHARS_IN_EVENT_TITLE} characters.`;
  }

  if (description && description.length > MAX_CHARS_IN_EVENT_DESCRIPTION) {
    return `The event description cannot exceed ${MAX_CHARS_IN_EVENT_DESCRIPTION} characters.`;
  }

  return true;
};

export const createEventInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: CanCreateEventArgs, ctx: any, info: any) => {
    if (!args.eventCreateInput) {
      return "Missing eventCreateInput in args.";
    }
    return validateEventInput(args.eventCreateInput);
  }
);

export const updateEventInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: CanUpdateEventArgs, ctx: any, info: any) => {
    if (!args.eventCreateInput) {
      return "Missing eventCreateInput in args.";
    }
    return validateEventInput(args.eventCreateInput);
  }
);
