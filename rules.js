const jwt = require("jsonwebtoken");
const { rule } = require("graphql-shield");

const ERROR_MESSAGES = {
  generic: {
    noPermission: "You do not have permission to do that.",
  },
  channel: {
    notAuthenticated: "You must be logged in to do that.",
    notVerified: "You must verify your email address to do that.",
    notOwner: "You must be the owner of this channel to do that.",
    noChannelPermission: "You do not have permission to create channels.",
  },
};

const getUserFromEmail = async (email, EmailModel) => {
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

const setUserDataOnContext = async (context, token) => {
  const { ogm, req } = context;
  const decoded = jwt.decode(token.replace("Bearer ", ""));
  if (!decoded) {
    return {
      driver,
      req,
      ogm,
    };
  }

  const { email, email_verified } = decoded;
  const Email = ogm.model("Email");
  const User = ogm.model("User");

  username = await getUserFromEmail(email, Email);

  // Set the user data on the context so we can use it in other rules.
  const userData = await User.find({
    where: { username },
  });
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
  console.log('could not find user data, returning null')
  return null;
};

const isAuthenticatedAndVerified = rule({ cache: "contextual" })(async (parent, args, context, info) => {
  const token = context.req?.headers?.authorization || "";
  if (!token) {
    return new Error(ERROR_MESSAGES.channel.notAuthenticated);
  }

  // Set user data on context
  context.user = await setUserDataOnContext(context, token);
  if (!context.user?.username) {
    return new Error(ERROR_MESSAGES.channel.notAuthenticated);
  }

  if (!context.user.email_verified) {
    return new Error(ERROR_MESSAGES.channel.notVerified);
  }

  return true;
});


const isChannelOwner = rule({ cache: "contextual" })(
  async (parent, args, ctx, info) => {
    let username = ctx.user.username;
    const { channelId, Channel } = args;

    // Get the list of channel owners by using the OGM on the
    // Channel object.
    const channelOwners = []; // to do.

    // Check if the user is in the list of channel owners.
    if (!channelOwners.includes(username)) {
      return new Error(ERROR_MESSAGES.channel.notOwner);
    }

    return true;
  }
);

const hasServerPermission = rule({ cache: "contextual" })(
  async (parent, args, ctx) => {
    // Your logic here, using the 'permission' argument
    // Example logic: check if ctx.user.permissions includes the given permission
    if (!ctx.user.permissions) {
      return new Error(ERROR_MESSAGES.generic.noPermission);
    }
    return true;
  }
);

const hasChannelPermission = rule({ cache: "contextual" })(
  async (parent, args, ctx, info) => {
    // example of channel permission is CreateEvents.
    const { permission, Channel } = args;
    const { username } = ctx.user;

    // Get the list of channel permissions on the User object.
    const channelRoles = []; // to do.

    // If there are no channel roles on the user object,
    // get the default channel role. This is located on the
    // ChannelConfig object.
    // if (!channelRoles.length) {
    //   const channelConfig = await ChannelConfig.find({
    //     where: { channelId: Channel.id },
    //   });
    //   channelRoles.push(channelConfig[0]?.defaultChannelRole);
    // }

    // Loop over the list of channel roles. They all
    // must explicitly allow the permission.
    // Otherwise, if one says false or is missing
    // the permission, return false.
    // for (const channelRole of channelRoles) {
    //   const channelRolePermissions = []; // to do.
    //   if (!channelRolePermissions.includes(permission)) {
    //     return false;
    //   }
    // }
    return true;
  }
);

const isAdmin = rule({ cache: "contextual" })(
  async (parent, args, ctx, info) => {
    const { isAdmin } = ctx.user;
    return isAdmin;
  }
);

const rules = {
  isChannelOwner,
  isAuthenticatedAndVerified,
  hasServerPermission,
  hasChannelPermission,
  isAdmin,
};

module.exports = rules;
