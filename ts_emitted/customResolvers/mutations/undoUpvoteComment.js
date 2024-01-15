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
import { commentIsUpvotedByUserQuery } from "../cypher/cypherQueries";
import { getWeightedVoteBonus } from "./utils";
var undoUpvoteCommentResolver = function (_a) {
    var Comment = _a.Comment, User = _a.User, driver = _a.driver;
    return function (parent, args, context, resolveInfo) { return __awaiter(void 0, void 0, void 0, function () {
        var commentId, username, session, tx, result, singleRecord, upvotedByUser, commentSelectionSet, commentResult, comment, postAuthorUsername, postAuthorKarma, userSelectionSet, voterUserResult, voterUser, weightedVoteBonus, undoUpvoteCommentQuery, existingUpvotedByUsers, existingUpvotedByUsersAggregate, e_1, rollbackError_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    commentId = args.commentId, username = args.username;
                    if (!commentId || !username) {
                        throw new Error("All arguments (commentId, username) are required");
                    }
                    session = driver.session();
                    tx = session.beginTransaction();
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 9, 14, 15]);
                    return [4 /*yield*/, tx.run(commentIsUpvotedByUserQuery, {
                            username: username,
                            commentId: commentId,
                        })];
                case 2:
                    result = _c.sent();
                    singleRecord = result.records[0];
                    upvotedByUser = singleRecord.get("result").upvotedByUser;
                    if (!upvotedByUser) {
                        throw new Error("Can't undo upvote because you haven't upvoted this comment yet");
                    }
                    commentSelectionSet = "\n        {\n          id\n          CommentAuthor {\n              ... on User {\n                  username\n                  commentKarma\n                  createdAt\n              }\n          }\n          weightedVotesCount\n          UpvotedByUsers {\n              username\n          }\n          UpvotedByUsersAggregate {\n              count\n          }\n        }\n      ";
                    return [4 /*yield*/, Comment.find({
                            where: {
                                id: commentId,
                            },
                            selectionSet: commentSelectionSet,
                        })];
                case 3:
                    commentResult = _c.sent();
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
                    voterUserResult = _c.sent();
                    if (voterUserResult.length === 0) {
                        throw new Error("User data not found for the user who is undoing the upvote");
                    }
                    voterUser = voterUserResult[0];
                    weightedVoteBonus = getWeightedVoteBonus(voterUser);
                    undoUpvoteCommentQuery = "\n       MATCH (c:Comment { id: $commentId })<-[r:UPVOTED_COMMENT]-(u:User { username: $username })\n       SET c.weightedVotesCount = coalesce(c.weightedVotesCount, 0) - 1 - $weightedVoteBonus\n       DELETE r\n       RETURN c\n     ";
                    return [4 /*yield*/, tx.run(undoUpvoteCommentQuery, {
                            commentId: commentId,
                            username: username,
                            weightedVoteBonus: weightedVoteBonus,
                        })];
                case 5:
                    _c.sent();
                    if (!postAuthorUsername) return [3 /*break*/, 7];
                    return [4 /*yield*/, User.update({
                            where: { username: postAuthorUsername },
                            update: { commentKarma: postAuthorKarma - 1 },
                        })];
                case 6:
                    _c.sent();
                    _c.label = 7;
                case 7: return [4 /*yield*/, tx.commit()];
                case 8:
                    _c.sent();
                    existingUpvotedByUsers = comment.UpvotedByUsers || [];
                    existingUpvotedByUsersAggregate = comment.UpvotedByUsersAggregate || { count: 0 };
                    return [2 /*return*/, {
                            id: commentId,
                            weightedVotesCount: comment.weightedVotesCount - 1 - weightedVoteBonus,
                            UpvotedByUsers: existingUpvotedByUsers.filter(function (user) { return user.username !== username; }),
                            UpvotedByUsersAggregate: {
                                count: existingUpvotedByUsersAggregate.count - 1,
                            },
                        }];
                case 9:
                    e_1 = _c.sent();
                    if (!tx) return [3 /*break*/, 13];
                    _c.label = 10;
                case 10:
                    _c.trys.push([10, 12, , 13]);
                    return [4 /*yield*/, tx.rollback()];
                case 11:
                    _c.sent();
                    return [3 /*break*/, 13];
                case 12:
                    rollbackError_1 = _c.sent();
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
module.exports = undoUpvoteCommentResolver;
