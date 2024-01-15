import jwt from "jsonwebtoken";
import { rule } from "graphql-shield";
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
    var _a, _b;
    try {
        const emailDataWithUser = await EmailModel.find({
            where: { address: email },
            selectionSet: `{ User { username } }`,
        });
        return (_b = (_a = emailDataWithUser[0]) === null || _a === void 0 ? void 0 : _a.User) === null || _b === void 0 ? void 0 : _b.username;
    }
    catch (error) {
        console.error("Error fetching user from database:", error);
        return null;
    }
};
const setUserDataOnContext = async (context, getPermissionInfo) => {
    var _a;
    const { ogm, req } = context;
    const token = ((_a = req === null || req === void 0 ? void 0 : req.headers) === null || _a === void 0 ? void 0 : _a.authorization) || "";
    if (!token) {
        return new Error(ERROR_MESSAGES.channel.notAuthenticated);
    }
    const decoded = jwt.decode(token.replace("Bearer ", ""));
    if (!decoded) {
        return {
            driver,
            req,
            ogm,
        };
    }
    // @ts-ignore
    if (!(decoded === null || decoded === void 0 ? void 0 : decoded.email)) {
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
    }
    else {
        userData = await User.find({
            where: { username },
            selectionSet: `{ 
        ServerRoles { 
          name
          canCreateChannels
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
const isAuthenticatedAndVerified = rule({ cache: "contextual" })(async (parent, args, context, info) => {
    var _a;
    // Set user data on context
    context.user = await setUserDataOnContext(context, false);
    if (!((_a = context.user) === null || _a === void 0 ? void 0 : _a.username)) {
        return new Error(ERROR_MESSAGES.channel.notAuthenticated);
    }
    if (!context.user.email_verified) {
        return new Error(ERROR_MESSAGES.channel.notVerified);
    }
    console.log("passed rule: is authenticated and verified");
    return true;
});
const isChannelOwner = rule({ cache: "contextual" })(async (parent, args, ctx, info) => {
    let username = ctx.user.username;
    const { channelId, Channel } = args;
    // Get the list of channel owners by using the OGM on the
    // Channel object.
    const channelOwners = []; // to do.
    // Check if the user is in the list of channel owners.
    if (!channelOwners.includes(username)) {
        return new Error(ERROR_MESSAGES.channel.notOwner);
    }
    console.log("passed rule: is channel owner");
    return true;
});
const hasServerPermission = async (permission, context) => {
    var _a, _b, _c, _d;
    console.log('has server permission check is running. checking for permission named ', permission);
    // 1. Check for server roles on the user object.
    context.user = await setUserDataOnContext(context, true);
    console.log('set user data on context. user data is ', context.user);
    const usersServerRoles = ((_b = (_a = context.user) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.ServerRoles) || [];
    console.log('users server roles are ', usersServerRoles);
    // 2. If there is at least one server role on the user
    //    object, loop over them. All of them must explicitly
    //    allow the permission. Otherwise, if one says false
    //    or is not mentioned, return false.
    if (usersServerRoles.length > 0) {
        for (const serverRole of usersServerRoles) {
            if (!serverRole[permission]) {
                console.log("The user has a server role that does not allow this action.", permission, serverRole);
                return new Error(ERROR_MESSAGES.channel.noChannelPermission);
            }
        }
    }
    // 3. If there are no server roles on the user object,
    //    get the default server role. This is located on the
    //    ServerConfig object.
    else {
        console.log("Getting the default server role.");
        const ServerConfig = context.ogm.model("ServerConfig");
        const serverConfig = await ServerConfig.find({
            where: { name: process.env.SERVER_CONFIG_NAME },
        }, `{ DefaultServerRole { 
      canCreateChannels 
    } 
  }`);
        console.log("Checking the default server role", (_c = serverConfig[0]) === null || _c === void 0 ? void 0 : _c.DefaultServerRole);
        usersServerRoles.push((_d = serverConfig[0]) === null || _d === void 0 ? void 0 : _d.DefaultServerRole);
    }
    // Error handling: Make sure we could successfully fetch the
    // default server role. If not, return an error.
    if (!usersServerRoles[0]) {
        return new Error("Could not find permission on user's role or on the default server role.");
    }
    // 3. Check if the permission is allowed by the default
    //    server role.
    const serverRoleToCheck = usersServerRoles[0];
    console.log("Checking if the default server role can create channels.", serverRoleToCheck.canCreateChannel);
    if (permission === "createChannel") {
        return serverRoleToCheck.canCreateChannel;
    }
    console.log("The action is not allowed by the default server role.");
    return new Error(ERROR_MESSAGES.channel.noChannelPermission);
};
const canCreateChannel = rule({ cache: "contextual" })(async (parent, args, ctx, info) => {
    console.log(' can create channel rule is running ');
    const hasPermissionToCreateChannels = hasServerPermission("createChannel", ctx);
    if (hasPermissionToCreateChannels instanceof Error) {
        console.log("The user does not have permission to create channels.");
        return hasPermissionToCreateChannels;
    }
    console.log("passed rule: can create channel");
    return true;
});
const hasChannelPermission = rule({ cache: "contextual" })(async (parent, args, ctx, info) => {
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
    console.log("passed rule: has channel permission");
    return true;
});
const isAdmin = rule({ cache: "contextual" })(async (parent, args, ctx, info) => {
    const { isAdmin } = ctx.user;
    console.log("passed rule: is admin");
    return isAdmin;
});
const ruleList = {
    isChannelOwner,
    isAuthenticatedAndVerified,
    canCreateChannel,
    hasChannelPermission,
    isAdmin,
};
export default ruleList;
