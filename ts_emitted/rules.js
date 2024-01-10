"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { User, ServerRole } = require("./src/generated/graphql");
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
const getUserFromEmail = (email, EmailModel) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const emailDataWithUser = yield EmailModel.find({
            where: { address: email },
            selectionSet: `{ User { username } }`,
        });
        return (_b = (_a = emailDataWithUser[0]) === null || _a === void 0 ? void 0 : _a.User) === null || _b === void 0 ? void 0 : _b.username;
    }
    catch (error) {
        console.error("Error fetching user from database:", error);
        return null;
    }
});
const setUserDataOnContext = (context, getPermissionInfo) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const { ogm, req } = context;
    const token = ((_c = req === null || req === void 0 ? void 0 : req.headers) === null || _c === void 0 ? void 0 : _c.authorization) || "";
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
    const { email, email_verified } = decoded;
    const Email = ogm.model("Email");
    const User = ogm.model("User");
    const username = yield getUserFromEmail(email, Email);
    // Set the user data on the context so we can use it in other rules.
    let userData;
    if (!getPermissionInfo) {
        userData = yield User.find({
            where: { username },
        });
    }
    else {
        userData = yield User.find({
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
});
const isAuthenticatedAndVerified = rule({ cache: "contextual" })((parent, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    // Set user data on context
    context.user = yield setUserDataOnContext(context, false);
    if (!((_d = context.user) === null || _d === void 0 ? void 0 : _d.username)) {
        return new Error(ERROR_MESSAGES.channel.notAuthenticated);
    }
    if (!context.user.email_verified) {
        return new Error(ERROR_MESSAGES.channel.notVerified);
    }
    console.log("passed rule: is authenticated and verified");
    return true;
}));
const isChannelOwner = rule({ cache: "contextual" })((parent, args, ctx, info) => __awaiter(void 0, void 0, void 0, function* () {
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
}));
const hasServerPermission = (permission, context) => __awaiter(void 0, void 0, void 0, function* () {
    var _e, _f, _g, _h;
    console.log('has server permission check is running. checking for permission named ', permission);
    // 1. Check for server roles on the user object.
    context.user = yield setUserDataOnContext(context, true);
    console.log('set user data on context. user data is ', context.user);
    const usersServerRoles = ((_f = (_e = context.user) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.ServerRoles) || [];
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
        const serverConfig = yield ServerConfig.find({
            where: { name: process.env.SERVER_CONFIG_NAME },
        }, `{ DefaultServerRole { 
      canCreateChannels 
    } 
  }`);
        console.log("Checking the default server role", (_g = serverConfig[0]) === null || _g === void 0 ? void 0 : _g.DefaultServerRole);
        usersServerRoles.push((_h = serverConfig[0]) === null || _h === void 0 ? void 0 : _h.DefaultServerRole);
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
});
const canCreateChannel = rule({ cache: "contextual" })((parent, args, ctx, info) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(' can create channel rule is running ');
    const hasPermissionToCreateChannels = hasServerPermission("createChannel", ctx);
    if (hasPermissionToCreateChannels instanceof Error) {
        console.log("The user does not have permission to create channels.");
        return hasPermissionToCreateChannels;
    }
    console.log("passed rule: can create channel");
    return true;
}));
const hasChannelPermission = rule({ cache: "contextual" })((parent, args, ctx, info) => __awaiter(void 0, void 0, void 0, function* () {
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
}));
const isAdmin = rule({ cache: "contextual" })((parent, args, ctx, info) => __awaiter(void 0, void 0, void 0, function* () {
    const { isAdmin } = ctx.user;
    console.log("passed rule: is admin");
    return isAdmin;
}));
const ruleList = {
    isChannelOwner,
    isAuthenticatedAndVerified,
    canCreateChannel,
    hasChannelPermission,
    isAdmin,
};
module.exports = ruleList;
