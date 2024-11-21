import { ERROR_MESSAGES } from "../errorMessages.js";
import { EmailModel } from "../../ogm-types.js";
import { rule } from "graphql-shield";
import jwt from "jsonwebtoken";
import axios from "axios";

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

  if (!token) {
    console.log("No token found in headers");
    return null;
  }

  try {
    // Verify the token
    if (!process.env.AUTH0_SECRET_KEY) {
      throw new Error("No AUTH0_SECRET_KEY found in environment variables");
    }

    const decoded = jwt.verify(
      token.replace("Bearer ", ""),
      process.env.AUTH0_SECRET_KEY
    );

    // Check for email in the token
    if (typeof decoded === "string") {
      throw new Error("Token is a string");
    }

    let decodedEmail = decoded?.username; // The username is the email

    if (!decodedEmail) {
      console.log("No email in token, fetching from Auth0");
      const userInfoResponse = await axios.get(
        `https://${process.env.AUTH0_DOMAIN}/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${token.replace("Bearer ", "")}`,
          },
        }
      );
      decodedEmail = userInfoResponse.data.email;
    }

    if (!decodedEmail) {
      throw new Error(ERROR_MESSAGES.channel.notAuthenticated);
    }

    // Log email and set up models
    const email = decodedEmail;
    console.log("email: ", email);
    const Email = ogm.model("Email");
    const User = ogm.model("User");

    const username = await getUserFromEmail(email, Email);

    // Set the user data on the context
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
                showAdminTag
                canCreateChannel
                canCreateComment
                canCreateDiscussion
                canCreateEvent
                canGiveFeedback
                canUploadFile
                canUpvoteComment
                canUpvoteDiscussion
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
        email_verified: decoded.email_verified,
        data: userData[0],
      };
    }
    return null;
  } catch (error) {
    console.error("Error setting user data on context:", error);
    throw new Error(ERROR_MESSAGES.channel.notAuthenticated);
  }
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
