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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { commentIsUpvotedByUserQuery } from "../cypher/cypherQueries";
import { getWeightedVoteBonus } from "./utils";
var upvoteCommentResolver = function (_a) {
    var Comment = _a.Comment, User = _a.User, driver = _a.driver;
    return function (parent, args, context, resolveInfo) { return __awaiter(void 0, void 0, void 0, function () {
        var commentId, username, session, tx, result, singleRecord, upvotedByUser, commentSelectionSet, commentResult, comment, postAuthorUsername, postAuthorKarma, userSelectionSet, upvoterUserResult, upvoterUser, weightedVoteBonus, updateCommentQuery, existingUpvotedByUsers, existingUpvotedByUsersCount, e_1, rollbackError_1;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    commentId = args.commentId, username = args.username;
                    if (!commentId || !username) {
                        throw new Error("All arguments (commentId, username) are required");
                    }
                    session = driver.session();
                    tx = session.beginTransaction();
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 9, 14, 15]);
                    return [4 /*yield*/, tx.run(commentIsUpvotedByUserQuery, {
                            username: username,
                            commentId: commentId,
                        })];
                case 2:
                    result = _d.sent();
                    singleRecord = result.records[0];
                    upvotedByUser = singleRecord.get("result").upvotedByUser;
                    if (upvotedByUser) {
                        throw new Error("You have already upvoted this comment");
                    }
                    commentSelectionSet = "\n        {\n          id\n          CommentAuthor {\n              ... on User {\n                  username\n                  commentKarma\n                  createdAt\n              }\n          }\n          weightedVotesCount\n          UpvotedByUsers {\n            username\n          }\n          UpvotedByUsersAggregate {\n            count\n          }\n        }\n      ";
                    return [4 /*yield*/, Comment.find({
                            where: {
                                id: commentId,
                            },
                            selectionSet: commentSelectionSet,
                        })];
                case 3:
                    commentResult = _d.sent();
                    if (commentResult.length === 0) {
                        throw new Error("Comment not found");
                    }
                    comment = commentResult[0];
                    postAuthorUsername = (_a = comment.CommentAuthor) === null || _a === void 0 ? void 0 : _a.username;
                    postAuthorKarma = ((_b = comment.CommentAuthor) === null || _b === void 0 ? void 0 : _b.commentKarma) || 0;
                    userSelectionSet = "\n      {\n          username\n          commentKarma\n      }\n     ";
                    return [4 /*yield*/, User.find({
                            where: {
                                username: username,
                            },
                            selectionSet: userSelectionSet,
                        })];
                case 4:
                    upvoterUserResult = _d.sent();
                    if (upvoterUserResult.length === 0) {
                        throw new Error("User not found");
                    }
                    upvoterUser = upvoterUserResult[0];
                    weightedVoteBonus = getWeightedVoteBonus(upvoterUser);
                    updateCommentQuery = "\n        MATCH (c:Comment { id: $commentId }), (u:User { username: $username })\n        SET c.weightedVotesCount = coalesce(c.weightedVotesCount, 0) + 1 + $weightedVoteBonus\n        CREATE (u)-[:UPVOTED_COMMENT]->(c)\n        RETURN c\n      ";
                    return [4 /*yield*/, tx.run(updateCommentQuery, {
                            commentId: commentId,
                            username: username,
                            weightedVoteBonus: weightedVoteBonus,
                        })];
                case 5:
                    _d.sent();
                    if (!postAuthorUsername) return [3 /*break*/, 7];
                    return [4 /*yield*/, User.update({
                            where: { username: postAuthorUsername },
                            update: { commentKarma: postAuthorKarma + 1 },
                        })];
                case 6:
                    _d.sent();
                    _d.label = 7;
                case 7: return [4 /*yield*/, tx.commit()];
                case 8:
                    _d.sent();
                    existingUpvotedByUsers = comment.UpvotedByUsers || [];
                    existingUpvotedByUsersCount = ((_c = comment.UpvotedByUsersAggregate) === null || _c === void 0 ? void 0 : _c.count) || 0;
                    return [2 /*return*/, {
                            id: commentId,
                            weightedVotesCount: comment.weightedVotesCount + 1 + weightedVoteBonus,
                            UpvotedByUsers: __spreadArray(__spreadArray([], existingUpvotedByUsers, true), [
                                {
                                    username: username,
                                },
                            ], false),
                            UpvotedByUsersAggregate: {
                                count: existingUpvotedByUsersCount + 1,
                            },
                        }];
                case 9:
                    e_1 = _d.sent();
                    if (!tx) return [3 /*break*/, 13];
                    _d.label = 10;
                case 10:
                    _d.trys.push([10, 12, , 13]);
                    return [4 /*yield*/, tx.rollback()];
                case 11:
                    _d.sent();
                    return [3 /*break*/, 13];
                case 12:
                    rollbackError_1 = _d.sent();
                    console.error("Failed to rollback transaction", rollbackError_1);
                    return [3 /*break*/, 13];
                case 13:
                    console.error(e_1);
                    return [3 /*break*/, 15];
                case 14:
                    if (session) {
                        try {
                            session.close();
                        }
                        catch (sessionCloseError) {
                            console.error("Failed to close session", sessionCloseError);
                        }
                    }
                    return [7 /*endfinally*/];
                case 15: return [2 /*return*/];
            }
        });
    }); };
};
export default upvoteCommentResolver;
