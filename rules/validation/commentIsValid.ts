import { rule } from "graphql-shield";
import { CommentCreateInput, CommentUpdateInput } from "../../src/generated/graphql.js";
import { MAX_CHARS_IN_COMMENT_TEXT } from "./constants.js";

type CommentTextValidationInput = {
  text: string;
  modProfileName?: string;
  username?: string;
}

const validateCommentInput = (input: CommentTextValidationInput): true | string => {
  const { text, modProfileName, username } = input;
  if (!username || !modProfileName) {
    return "Comment author is required.";
  }
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
    if (!args.input || !args.input[0] || !args.input[0]) {
      return "Missing or empty input in args.";
    }
    const createCommentInput: CommentCreateInput = args.input[0]
    return validateCommentInput({
      text: createCommentInput.text || "",
      modProfileName: createCommentInput?.CommentAuthor?.ModerationProfile?.connect?.where?.node?.displayName || "",
      username: createCommentInput?.CommentAuthor?.User?.connect?.where?.node?.username || ""
    });
  }
);

type UpdateCommentInput = { update: CommentUpdateInput };
export const updateCommentInputIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: UpdateCommentInput, ctx: any, info: any) => {
    if (!args.update) {
      return "Missing update input in args.";
    }
    return validateCommentInput({
      text: args.update?.text || "",
      modProfileName: args.update?.CommentAuthor?.ModerationProfile?.connect?.where?.node?.displayName || "",
      username: args.update?.CommentAuthor?.User?.connect?.where?.node?.username || ""
    });
  }
);
