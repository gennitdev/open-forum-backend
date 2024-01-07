const { shield, allow, deny, rule, and } = require("graphql-shield");
const jwt = require("jsonwebtoken");

const getUserFromEmail = async (email, EmailModel) => {
  console.log("getting user from email", email);
  try {
    const emailDataWithUser = await EmailModel.find({
      where: { address: email },
      selectionSet: `{ User { username } }`,
    });
    console.log("found", emailDataWithUser[0]?.User?.username);
    return emailDataWithUser[0]?.User?.username;
  } catch (error) {
    console.error("Error fetching user from database:", error);
    return null;
  }
};

const isAuthenticated = rule({ cache: "contextual" })(
  async (parent, args, context, info) => {
    console.log("I RAN")
    return false
    const { req, ogm } = context;

    const token = req?.headers?.authorization || "";

    if (!token) {
      return false;
    }

    let username = null;

    // Decode the token
    try {
      const decoded =jwt.decode(token.replace("Bearer ", ""));
      console.log("decoded is", decoded);
      if (!decoded) {
        return {
          driver,
          req,
          ogm,
        };
      }

      const { email } = decoded;

      const Email = ogm.model("Email");

      username = await getUserFromEmail(email, Email);
    } catch (e) {
      console.error("Error decoding token:", e);
      return false;
    }

    console.log("user", username);

    // console.log(decoded);
    console.log("checking if authenticated", username);
    if (!username) {
      return false;
    }
    return true;
  }
);

// Contextual
const isChannelOwner = rule({ cache: "contextual" })(
  async (parent, args, ctx, info) => {
    let username = ctx.user.username;
    const { channelId, Channel } = args;

    // Get the list of channel owners by using the OGM on the
    // Channel object.
    const channelOwners = []; // to do.

    // Check if the user is in the list of channel owners.
    if (!channelOwners.includes(username)) {
      return false;
    }

    return true;
  }
);

const rules = {
  isAuthenticated,
  isChannelOwner,
};

const permissions = shield({
  Query: {
    "*": allow,
  },
  Mutation: {
    "*": deny,
    updateChannels: and(rules.isAuthenticated, rules.isChannelOwner),
    createChannels: rules.isAuthenticated,
  },
});

module.exports = permissions;
