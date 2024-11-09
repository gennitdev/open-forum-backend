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
  console.log("setting user data on context");
  const { context, getPermissionInfo } = input;
  const { ogm, req } = context;
  const token = req?.headers?.authorization || "";
  console.log("request headers", req.headers);
  
  if (!token) {
    console.error("No token found in headers");
    throw new Error(ERROR_MESSAGES.channel.notAuthenticated);
  }

  const decoded = jwt.decode(token.replace("Bearer ", ""));
  if (!decoded) {
    console.error("No decoded token found");
    throw new Error(ERROR_MESSAGES.channel.notAuthenticated);
  }
  console.log("decoded: ", decoded);

  // @ts-ignore
  if (!decoded?.email) {
    throw new Error(ERROR_MESSAGES.channel.notAuthenticated);
  }

  // @ts-ignore
  const { email, email_verified } = decoded;
  console.log("email: ", email);
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
    try {
      userData = await User.find({
        where: { username },
        selectionSet: `{ 
            ModerationProfile {
              displayName
              ModServerRoles {
                canGiveFeedback
              }
              ModChannelRoles ${
                input.checkSpecificChannel
                  ? `(where: { channelUniqueName: "${input.checkSpecificChannel}" })`
                  : ""
              } {
                canGiveFeedback
              }
            }
            ServerRoles { 
              name
              canCreateChannel
            }
            ChannelRoles ${
              input.checkSpecificChannel
                ? `(where: { channelUniqueName: "${input.checkSpecificChannel}" })`
                : ""
            } {
              name
              canCreateEvent
              canCreateDiscussion
              canCreateComment
            }
          }`,
      });
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  }

  if (userData && userData[0]) {
    return {
      username,
      email_verified,
      data: userData[0],
    };
  }
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
      throw new Error(ERROR_MESSAGES.channel.notAuthenticated);
    }

    if (!context.user.email_verified) {
      throw new Error(ERROR_MESSAGES.channel.notVerified);
    }
    return true;
  }
);
