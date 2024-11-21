import { ERROR_MESSAGES } from "../errorMessages.js";
import { EmailModel } from "../../ogm-types.js";
import { rule } from "graphql-shield";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});
console.log("JWKS Client Config:", client);


const getKey = (header: any, callback: any) => {
  console.log("JWT Header:", header); 
  if (!header || !header.kid) {
    return callback(new Error("Missing 'kid' in JWT header"), null);
  }

  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error("Error retrieving signing key:", err);
      if ((err as any)?.code === "ENOTFOUND") {
        console.error(`DNS resolution failed for domain: ${process.env.AUTH0_DOMAIN}`);
      }
      return callback(err, null);
    }
    const signingKey = key?.getPublicKey();
    console.log("Retrieved Signing Key:", signingKey);
    callback(null, signingKey);
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
  console.log("Setting user data on context...");
  const { context, getPermissionInfo } = input;
  const { ogm, req } = context;

  // Extract token from the request headers
  const token = req?.headers?.authorization?.replace("Bearer ", "");
  console.log("Token:", token);

  // If no token is provided, set null user data and return
  if (!token) {
    console.log("No token found; setting user data to null.");
    return {
      username: null,
      email_verified: false,
      data: null,
    };
  }

  // Log the Auth0 domain for debugging
  console.log("Auth0 domain:", process.env.AUTH0_DOMAIN);

  if (!process.env.AUTH0_DOMAIN) {
    throw new Error("AUTH0_DOMAIN environment variable is not defined.");
  }

  let decoded: any;

  try {
    console.log("Verifying token...");
    decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        { algorithms: ["RS256"] },
        (err, decoded) => {
          if (err) {
            console.error("JWT Verification Error:", err);
            return reject(err);
          }
          resolve(decoded);
        }
      );
    });
  } catch (error: any) {
    console.error("Error verifying token:", error.message);
    // If token verification fails, return null user data
    return {
      username: null,
      email_verified: false,
      data: null,
    };
  }

  console.log("Decoded token:", decoded);

  // Extract email or username from the decoded token
  const email = decoded?.email || decoded?.username;
  console.log("Decoded email:", email);

  if (!email) {
    console.log("No email found in the token; setting user data to null.");
    return {
      username: null,
      email_verified: false,
      data: null,
    };
  }

  console.log("Email found:", email);

  const Email = ogm.model("Email");
  const User = ogm.model("User");

  // Fetch username from the database using email
  const username = await getUserFromEmail(email, Email);

  // If the username is not found, set null user data
  if (!username) {
    console.log("No username found for the email; setting user data to null.");
    return {
      username: null,
      email_verified: false,
      data: null,
    };
  }

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

    console.log("User data fetched:", userData);
    return {
      username,
      email_verified: decoded?.email_verified || false,
      data: userData[0],
    };
  } catch (error: any) {
    console.error("Error fetching user data:", error.message);
    return {
      username: null,
      email_verified: false,
      data: null,
    };
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
