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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a = require("./src/generated/graphql"), User = _a.User, ServerRole = _a.ServerRole;
var jwt = require("jsonwebtoken");
var rule = require("graphql-shield").rule;
var ERROR_MESSAGES = {
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
var getUserFromEmail = function (email, EmailModel) { return __awaiter(void 0, void 0, void 0, function () {
    var emailDataWithUser, error_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                return [4 /*yield*/, EmailModel.find({
                        where: { address: email },
                        selectionSet: "{ User { username } }",
                    })];
            case 1:
                emailDataWithUser = _c.sent();
                return [2 /*return*/, (_b = (_a = emailDataWithUser[0]) === null || _a === void 0 ? void 0 : _a.User) === null || _b === void 0 ? void 0 : _b.username];
            case 2:
                error_1 = _c.sent();
                console.error("Error fetching user from database:", error_1);
                return [2 /*return*/, null];
            case 3: return [2 /*return*/];
        }
    });
}); };
var setUserDataOnContext = function (context, getPermissionInfo) { return __awaiter(void 0, void 0, void 0, function () {
    var ogm, req, token, decoded, email, email_verified, Email, User, username, userData;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                ogm = context.ogm, req = context.req;
                token = ((_a = req === null || req === void 0 ? void 0 : req.headers) === null || _a === void 0 ? void 0 : _a.authorization) || "";
                if (!token) {
                    return [2 /*return*/, new Error(ERROR_MESSAGES.channel.notAuthenticated)];
                }
                decoded = jwt.decode(token.replace("Bearer ", ""));
                if (!decoded) {
                    return [2 /*return*/, {
                            driver: driver,
                            req: req,
                            ogm: ogm,
                        }];
                }
                email = decoded.email, email_verified = decoded.email_verified;
                Email = ogm.model("Email");
                User = ogm.model("User");
                return [4 /*yield*/, getUserFromEmail(email, Email)];
            case 1:
                username = _b.sent();
                if (!!getPermissionInfo) return [3 /*break*/, 3];
                return [4 /*yield*/, User.find({
                        where: { username: username },
                    })];
            case 2:
                userData = _b.sent();
                return [3 /*break*/, 5];
            case 3: return [4 /*yield*/, User.find({
                    where: { username: username },
                    selectionSet: "{ \n        ServerRoles { \n          name\n          canCreateChannels\n        } \n      }",
                })];
            case 4:
                userData = _b.sent();
                _b.label = 5;
            case 5:
                console.log("found user data", userData);
                if (userData && userData[0]) {
                    console.log("setting user data on context", {
                        username: username,
                        email_verified: email_verified,
                        data: userData[0],
                    });
                    return [2 /*return*/, {
                            username: username,
                            email_verified: email_verified,
                            data: userData[0],
                        }];
                }
                console.log("could not find user data, returning null");
                return [2 /*return*/, null];
        }
    });
}); };
var isAuthenticatedAndVerified = rule({ cache: "contextual" })(function (parent, args, context, info) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                // Set user data on context
                _a = context;
                return [4 /*yield*/, setUserDataOnContext(context, false)];
            case 1:
                // Set user data on context
                _a.user = _c.sent();
                if (!((_b = context.user) === null || _b === void 0 ? void 0 : _b.username)) {
                    return [2 /*return*/, new Error(ERROR_MESSAGES.channel.notAuthenticated)];
                }
                if (!context.user.email_verified) {
                    return [2 /*return*/, new Error(ERROR_MESSAGES.channel.notVerified)];
                }
                console.log("passed rule: is authenticated and verified");
                return [2 /*return*/, true];
        }
    });
}); });
var isChannelOwner = rule({ cache: "contextual" })(function (parent, args, ctx, info) { return __awaiter(void 0, void 0, void 0, function () {
    var username, channelId, Channel, channelOwners;
    return __generator(this, function (_a) {
        username = ctx.user.username;
        channelId = args.channelId, Channel = args.Channel;
        channelOwners = [];
        // Check if the user is in the list of channel owners.
        if (!channelOwners.includes(username)) {
            return [2 /*return*/, new Error(ERROR_MESSAGES.channel.notOwner)];
        }
        console.log("passed rule: is channel owner");
        return [2 /*return*/, true];
    });
}); });
var hasServerPermission = function (permission, context) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, usersServerRoles, _i, usersServerRoles_1, serverRole, ServerConfig, serverConfig, serverRoleToCheck;
    var _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                console.log('has server permission check is running. checking for permission named ', permission);
                // 1. Check for server roles on the user object.
                _a = context;
                return [4 /*yield*/, setUserDataOnContext(context, true)];
            case 1:
                // 1. Check for server roles on the user object.
                _a.user = _f.sent();
                console.log('set user data on context. user data is ', context.user);
                usersServerRoles = ((_c = (_b = context.user) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.ServerRoles) || [];
                console.log('users server roles are ', usersServerRoles);
                if (!(usersServerRoles.length > 0)) return [3 /*break*/, 2];
                for (_i = 0, usersServerRoles_1 = usersServerRoles; _i < usersServerRoles_1.length; _i++) {
                    serverRole = usersServerRoles_1[_i];
                    if (!serverRole[permission]) {
                        console.log("The user has a server role that does not allow this action.", permission, serverRole);
                        return [2 /*return*/, new Error(ERROR_MESSAGES.channel.noChannelPermission)];
                    }
                }
                return [3 /*break*/, 4];
            case 2:
                console.log("Getting the default server role.");
                ServerConfig = context.ogm.model("ServerConfig");
                return [4 /*yield*/, ServerConfig.find({
                        where: { name: process.env.SERVER_CONFIG_NAME },
                    }, "{ DefaultServerRole { \n      canCreateChannels \n    } \n  }")];
            case 3:
                serverConfig = _f.sent();
                console.log("Checking the default server role", (_d = serverConfig[0]) === null || _d === void 0 ? void 0 : _d.DefaultServerRole);
                usersServerRoles.push((_e = serverConfig[0]) === null || _e === void 0 ? void 0 : _e.DefaultServerRole);
                _f.label = 4;
            case 4:
                // Error handling: Make sure we could successfully fetch the
                // default server role. If not, return an error.
                if (!usersServerRoles[0]) {
                    return [2 /*return*/, new Error("Could not find permission on user's role or on the default server role.")];
                }
                serverRoleToCheck = usersServerRoles[0];
                console.log("Checking if the default server role can create channels.", serverRoleToCheck.canCreateChannel);
                if (permission === "createChannel") {
                    return [2 /*return*/, serverRoleToCheck.canCreateChannel];
                }
                console.log("The action is not allowed by the default server role.");
                return [2 /*return*/, new Error(ERROR_MESSAGES.channel.noChannelPermission)];
        }
    });
}); };
var canCreateChannel = rule({ cache: "contextual" })(function (parent, args, ctx, info) { return __awaiter(void 0, void 0, void 0, function () {
    var hasPermissionToCreateChannels;
    return __generator(this, function (_a) {
        console.log(' can create channel rule is running ');
        hasPermissionToCreateChannels = hasServerPermission("createChannel", ctx);
        if (hasPermissionToCreateChannels instanceof Error) {
            console.log("The user does not have permission to create channels.");
            return [2 /*return*/, hasPermissionToCreateChannels];
        }
        console.log("passed rule: can create channel");
        return [2 /*return*/, true];
    });
}); });
var hasChannelPermission = rule({ cache: "contextual" })(function (parent, args, ctx, info) { return __awaiter(void 0, void 0, void 0, function () {
    var permission, Channel, username, channelRoles;
    return __generator(this, function (_a) {
        permission = args.permission, Channel = args.Channel;
        username = ctx.user.username;
        channelRoles = [];
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
        return [2 /*return*/, true];
    });
}); });
var isAdmin = rule({ cache: "contextual" })(function (parent, args, ctx, info) { return __awaiter(void 0, void 0, void 0, function () {
    var isAdmin;
    return __generator(this, function (_a) {
        isAdmin = ctx.user.isAdmin;
        console.log("passed rule: is admin");
        return [2 /*return*/, isAdmin];
    });
}); });
var ruleList = {
    isChannelOwner: isChannelOwner,
    isAuthenticatedAndVerified: isAuthenticatedAndVerified,
    canCreateChannel: canCreateChannel,
    hasChannelPermission: hasChannelPermission,
    isAdmin: isAdmin,
};
module.exports = ruleList;
