import { ERROR_MESSAGES } from "../errorMessages.js";
import { EmailModel } from "../../ogm_types.js";
import { rule } from "graphql-shield";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import axios from "axios";
import NodeCache from "node-cache";

type CachedUserInfo = {
  email: string | null;
};

// Lazy initialization of the JWKS client
let client: any = null;

// Cache response from Auth0 userinfo endpoint
// so that we will not hit the rate limit.
const userInfoCache = new NodeCache({ stdTTL: 900 }); // Cache expires in 15 minutes

const getJwksClient = () => {
  if (!client) {
    if (!process.env.AUTH0_DOMAIN) {
      throw new Error("AUTH0_DOMAIN environment variable is not defined");
    }
    client = jwksClient({
      jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    });
    console.log("Initialized JWKS Client");
  }
  return client;
};

const getKey = (header: any, callback: any) => {
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
      console.log("Retrieved Signing Key");
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
  if (email === process.env.CYPRESS_ADMIN_TEST_EMAIL) {
    // Prevent a catch-22 in which the user data can't be created
    // because no one has permission to create the user data.
    return process.env.CYPRESS_ADMIN_TEST_USERNAME;
  }
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

  if (username === process.env.CYPRESS_ADMIN_TEST_USERNAME) {
    // Mock the response for the Cypress admin user
    // because the user data is not created in the database
    return {
      username,
      email: input.email,
      email_verified: emailVerified || false,
      data: {
        ServerRoles: [
          {
            name: "Admin Role",
            showAdminTag: true,
            canCreateChannel: true,
            canCreateComment: true,
            canCreateDiscussion: true,
            canCreateEvent: true,
            canGiveFeedback: true,
            canUploadFile: true,
            canUpvoteComment: true,
            canUpvoteDiscussion: true,
          },
        ],
        ChannelRoles: [],
        ModerationProfile: null,
      },
    };
  }
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

export const setUserDataOnContext = async (
  input: SetUserDataInput
): Promise<UserDataOnContext> => {
  console.log("Setting user data on context...");
  const { context } = input;
  const { ogm, req } = context;
  const token = req?.headers?.authorization?.replace("Bearer ", "");

  if (!token) {
    console.log("No token found; setting user data to null.");
    return {
      username: null,
      email: null,
      email_verified: false,
      data: null,
    };
  }

  if (!process.env.AUTH0_DOMAIN) {
    throw new Error("AUTH0_DOMAIN environment variable is not defined.");
  }

  let email: string | null = null;
  let decoded: any;
  let username: string | null | undefined = null;

  if (token) {
    console.log("Verifying token...");
    decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, getKey, { algorithms: ["RS256"] }, (err, decoded) => {
        if (!err) {
          resolve(decoded);
        } 
        console.error("JWT Verification Error:", err);
      });
    });

    // Check the audience of the token
    const audience = decoded?.aud;
    console.log({
      audience,
      clientId: process.env.AUTH0_CLIENT_ID,
    })

    if (audience === process.env.AUTH0_CLIENT_ID) {
      // UI-based token
      console.log("Token is a UI-based token, extracting email directly.");
      email = decoded?.email;
    } else if (
      Array.isArray(audience) &&
      audience.includes("https://gennit.us.auth0.com/api/v2/")
    ) {
      // Programmatic token
      console.log("Token is a programmatic token, using Auth0 Management API.");

      // Check if userinfo is cached
      const cachedUserInfo: CachedUserInfo | undefined =
        userInfoCache.get(token);

      if (cachedUserInfo) {
        console.log("Using cached user info.");
        email = cachedUserInfo.email;
      } else {
        console.log("Fetching email from Auth0 userinfo");
        try {
          const userInfoResponse = await axios.get(
            `https://${process.env.AUTH0_DOMAIN}/userinfo`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          email = userInfoResponse?.data?.email;
          console.log("Fetched email from Auth0 userinfo:", email);
        } catch (error) {
          console.error("Error fetching email from Auth0 userinfo:", error);
        }

        // Cache the userinfo response
        const userInfoToCache: CachedUserInfo = { email };
        userInfoCache.set(token, userInfoToCache);
      }
    }  else {
      console.error("Token audience is unrecognized.");
    }

    // Get the username from the email by calling getUserFromEmail
    if (email) {
      username = await getUserFromEmail(email, ogm.model("Email"));
    }
  }

  return {
    username: username || null,
    email,
    email_verified: false,
    data: {
      ServerRoles: [],
      ChannelRoles: [],
      ModerationProfile: null,
    },
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
