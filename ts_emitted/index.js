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
var Neo4jGraphQL = require("@neo4j/graphql").Neo4jGraphQL;
var ApolloServer = require("apollo-server").ApolloServer;
var applyMiddleware = require("graphql-middleware").applyMiddleware;
var typesDefinitions = require("./typeDefs");
var permissions = require("./permissions");
require("dotenv").config();
var neo4j = require("neo4j-driver");
var password = process.env.NEO4J_PASSWORD;
var driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", password));
var _a = require("./customResolvers")(driver), ogm = _a.ogm, resolvers = _a.resolvers;
var features = {
    filters: {
        String: {
            MATCHES: true,
        },
    },
};
// We're passing customResolvers to the Neo4jGraphQL constructor
var neoSchema = new Neo4jGraphQL({
    typeDefs: typesDefinitions,
    driver: driver,
    resolvers: resolvers,
    features: features,
});
// The DiscussionChannel represents the relationship between a Discussion and a Channel.
// Because the same Discussion should not be submitted to the same Channel twice,
// we need to create a uniqueness constraint on the DiscussionChannel relationship.
var constraintQuery = "\nCREATE CONSTRAINT discussion_channel_unique IF NOT EXISTS FOR (dc:DiscussionChannel)\nREQUIRE (dc.discussionId, dc.channelUniqueName) IS NODE KEY\n";
// The EventChannel represents the relationship between an Event and a Channel.
// Because the same Event should not be submitted to the same Channel twice,
// we need to create a uniqueness constraint on the EventChannel relationship.
var constraintQuery2 = "\nCREATE CONSTRAINT event_channel_unique IF NOT EXISTS FOR (ec:EventChannel)\nREQUIRE (ec.eventId, ec.channelUniqueName) IS NODE KEY\n";
function initializeServer() {
    return __awaiter(this, void 0, void 0, function () {
        var schema, server, e_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, neoSchema.getSchema()];
                case 1:
                    schema = _a.sent();
                    schema = applyMiddleware(schema, permissions);
                    return [4 /*yield*/, ogm.init()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, driver.session().run(constraintQuery)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, neoSchema.assertIndexesAndConstraints({ options: { create: true } })];
                case 4:
                    _a.sent();
                    server = new ApolloServer({
                        schema: schema,
                        context: function (input) { return __awaiter(_this, void 0, void 0, function () {
                            var req, queryString;
                            return __generator(this, function (_a) {
                                req = input.req;
                                queryString = "Query: ".concat(req.body.query);
                                if (!queryString.includes("IntrospectionQuery")) {
                                    console.log(queryString);
                                    console.log("Variables: ".concat(JSON.stringify(req.body.variables, null, 2)));
                                }
                                return [2 /*return*/, {
                                        driver: driver,
                                        req: req,
                                        ogm: ogm,
                                    }];
                            });
                        }); },
                    });
                    server.listen().then(function (input) {
                        var url = input.url;
                        console.log("\uD83D\uDE80  Server ready at ".concat(url));
                    });
                    return [3 /*break*/, 6];
                case 5:
                    e_1 = _a.sent();
                    console.error("Failed to initialize server:", e_1);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
initializeServer();
