import { ERROR_MESSAGES } from "../errorMessages.js";
import { EmailModel } from "../../ogm-types.js";
import { rule } from "graphql-shield";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import axios from "axios";

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

const getKey = (header: any, callback: any) => {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err, null);
    } else {
      if (key) {
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
      }
    }
  });
};

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
  const token = req?.headers?.authorization?.replace("Bearer ", "");
  console.log("token: ", token);

  if (!token) {
    console.log("No token found in headers");
    return null;
  }

  if (!process.env.AUTH0_SECRET_KEY) {
    throw new Error("No AUTH0_SECRET_KEY found in environment variables");
  }

  let decoded;

  try {
    console.log("verifying token");
    decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          algorithms: ["RS256"],
        },
        (err, decoded) => {
          if (err) {
            return reject(err);
          }
          resolve(decoded);
        }
      );
    });
  } catch (error) {
    console.error("Error verifying token:", error.message);
    throw new Error("Token verification failed");
  }

  if (!decoded || typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }

  const email = decoded?.email || decoded?.username;
  console.log("decoded email: ", email);

  if (!email) {
    try {
      console.log("Fetching email from Auth0 userinfo");
      const userInfoResponse = await axios.get(
        `https://${process.env.AUTH0_DOMAIN}/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      email = userInfoResponse.data.email;
    } catch (error) {
      console.error("Error fetching email from Auth0:", error.message);
      throw new Error("Failed to fetch email from Auth0");
    }
  }

  if (!email) {
    throw new Error("User email could not be determined");
  }

  console.log("email: ", email);
  const Email = ogm.model("Email");
  const User = ogm.model("User");

  const username = await getUserFromEmail(email, Email);

  let userData;
  try {
    const selectionSet = getPermissionInfo
      ? `{ 
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
        }`
      : undefined;

    userData = await User.find({
      where: { username },
      selectionSet,
    });
  } catch (error) {
    console.error("Error fetching user data:", error.message);
    throw new Error("Failed to fetch user data");
  }

  if (!userData || !userData[0]) {
    throw new Error("User not found");
  }

  return {
    username,
    email_verified: decoded?.email_verified || false,
    data: userData[0],
  };
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
