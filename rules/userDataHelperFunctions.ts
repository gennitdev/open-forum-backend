import { ERROR_MESSAGES } from "./errorMessages.js";
import { EmailModel } from "../ogm-types.js";
import { rule } from "graphql-shield";
import jwt from "jsonwebtoken";

export const getUserFromEmail = async (
  email: string,
  EmailModel: EmailModel
) => {
  try {
    const emailDataWithUser = await EmailModel.find({
      where: { address: email },
      selectionSet: `{ User { username } }`,
    });
    return emailDataWithUser[0]?.User?.username;
  } catch (error) {
    console.error("Error fetching user from database:", error);
    return null;
  }
};

type SetUserDataInput = {
  context: {
    ogm: any;
    req: any;
  };
  getPermissionInfo: boolean;
  checkSpecificChannel?: string;
};

export const setUserDataOnContext = async (input: SetUserDataInput) => {
  const { context, getPermissionInfo } = input;
  const { ogm, req } = context;
  const token = req?.headers?.authorization || "";
  if (!token) {
    return new Error(ERROR_MESSAGES.channel.notAuthenticated);
  }
  const decoded = jwt.decode(token.replace("Bearer ", ""));
  if (!decoded) {
    return {
      req,
      ogm,
    };
  }

  // @ts-ignore
  if (!decoded?.email) {
    return new Error(ERROR_MESSAGES.channel.notAuthenticated);
  }

  // @ts-ignore
  const { email, email_verified } = decoded;
  const Email = ogm.model("Email");
  const User = ogm.model("User");

  const username = await getUserFromEmail(email, Email);

  // Set the user data on the context so we can use it in other rules.
  let userData;
  if (!getPermissionInfo) {
    userData = await User.find({
      where: { username },
    });
  } else {
    userData = await User.find({
      where: { username },
      selectionSet: `{ 
          ServerRoles { 
            name
            canCreateChannel
          }
          ChannelRoles ${
            input.checkSpecificChannel
              ? `(where: { channelName: "${input.checkSpecificChannel}" })`
              : ""
          } {
            name
            canCreateEvent
            canCreateDiscussion
            canCreateComment
          }
        }`,
    });
  }
  console.log("found user data", userData);

  if (userData && userData[0]) {
    console.log("setting user data on context", {
      username,
      email_verified,
      data: userData[0],
    });
    return {
      username,
      email_verified,
      data: userData[0],
    };
  }
  console.log("could not find user data, returning null");
  return null;
};

export const isAuthenticatedAndVerified = rule({ cache: "contextual" })(
  async (parent: any, args: any, context: any, info: any) => {
    // Set user data on context
    context.user = await setUserDataOnContext({
      context,
      getPermissionInfo: false,
    });
    if (!context.user?.username) {
      return new Error(ERROR_MESSAGES.channel.notAuthenticated);
    }

    if (!context.user.email_verified) {
      return new Error(ERROR_MESSAGES.channel.notVerified);
    }

    console.log("passed rule: is authenticated and verified");
    return true;
  }
);
