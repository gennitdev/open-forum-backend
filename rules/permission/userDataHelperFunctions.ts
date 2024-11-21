import { ERROR_MESSAGES } from "../errorMessages.js";
import { EmailModel } from "../../ogm-types.js";
import { rule } from "graphql-shield";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import axios from "axios";

// Lazy initialization of the JWKS client
let client: any = null;

const getJwksClient = () => {
  if (!client) {
    if (!process.env.AUTH0_DOMAIN) {
      throw new Error("AUTH0_DOMAIN environment variable is not defined");
    }
    client = jwksClient({
      jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    });
    console.log("Initialized JWKS Client:", client);
  }
  return client;
};

const getKey = (header: any, callback: any) => {
  console.log("JWT Header:", header); // Debug the JWT header
  if (!header || !header.kid) {
    return callback(new Error("Missing 'kid' in JWT header"), null);
  }

  try {
    const jwksClientInstance = getJwksClient(); // Lazily initialize the JWKS client
    jwksClientInstance.getSigningKey(header.kid, (err: any, key: any) => {
      if (err) {
        console.error("Error retrieving signing key:", err);
        if (err.code === "ENOTFOUND") {
          console.error(
            `DNS resolution failed for domain: ${process.env.AUTH0_DOMAIN}`
          );
        }
        return callback(err, null);
      }
      const signingKey = key.getPublicKey();
      console.log("Retrieved Signing Key:", signingKey);
      callback(null, signingKey);
    });
  } catch (error) {
    console.error("Error initializing JWKS client or retrieving key:", error);
    return callback(error, null);
  }
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

type GetUserDataFromUsernameInput = {
  username: string;
  email: string | null;
  checkSpecificChannel?: string;
  ogm: any;
  emailVerified?: boolean;
};


export const getUserDataFromUsername = async (
  input: GetUserDataFromUsernameInput
): Promise<UserDataOnContext> => {
  const { username, emailVerified, ogm, checkSpecificChannel } = input;
  const User = ogm.model("User");
  let userData = null;
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
              checkSpecificChannel
                ? `(where: { channelUniqueName: "${checkSpecificChannel}" })`
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

    console.log("User data fetched:", userData);
    return {
      username,
      email: input.email,
      email_verified: emailVerified || false,
      data: userData[0],
    };
  } catch (error: any) {
    console.error("Error fetching user data:", error.message);
    return {
      username: null,
      email: null,
      email_verified: false,
      data: {
        ServerRoles: [],
        ChannelRoles: [],
        ModerationProfile: null,
      },
    };
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

export type UserDataOnContext = {
  username: string | null;
  email: string | null;
  email_verified: boolean;
  data: any;
};

export const setUserDataOnContext = async (input: SetUserDataInput): Promise<UserDataOnContext> => {
  console.log("Setting user data on context...");
  const { context, getPermissionInfo } = input;
  const { ogm, req } = context;

  const userData: UserDataOnContext = {
    username: null,
    email: null,
    email_verified: false,
    data: null,
  }

  // Extract token from the request headers
  const token = req?.headers?.authorization?.replace("Bearer ", "");

  // If no token is provided, set null user data and return
  if (!token) {
    console.log("No token found; setting user data to null.");
    return {
      username: null,
      email: null,
      email_verified: false,
      data: null,
    };
  }

  // Log the Auth0 domain for debugging
  console.log("Auth0 domain:", process.env.AUTH0_DOMAIN);

  if (!process.env.AUTH0_DOMAIN) {
    throw new Error("AUTH0_DOMAIN environment variable is not defined.");
  }

  let email: string | null = null;
  let decoded: any;

  if (token) {
    console.log("Verifying token...");
    decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, getKey, { algorithms: ["RS256"] }, (err, decoded) => {
        if (err) {
          console.error("JWT Verification Error:", err);
          return reject(err);
        }
        resolve(decoded);
      });
    });

    console.log("Fetching email from Auth0 userinfo");
    const userInfoResponse = await axios.get(
      `https://${process.env.AUTH0_DOMAIN}/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("Userinfo response:", userInfoResponse.data);
    email = userInfoResponse.data.email;
  }

  console.log("Email found:", email);

  const Email = ogm.model("Email");

  // Fetch username from the database using email
  const username = email ? await getUserFromEmail(email, Email) : null;

  // If the username is not found, set null user data
  if (!username) {
    console.log("No username found for the email; setting user data to null.");
    return {
      username: null,
      email: null,
      email_verified: false,
      data: {
        ServerRoles: [],
        ChannelRoles: [],
        ModerationProfile: null,
      },
    };
  }

  console.log("decoded email: ", email);

  return getUserDataFromUsername({
    email,
    username,
    checkSpecificChannel: input.checkSpecificChannel,
    ogm,
    emailVerified: decoded?.email_verified,
  });
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
