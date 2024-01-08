"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
    overwrite: true,
    schema: "http://localhost:4000",
    generates: {
        "src/generated/graphql.ts": {
            plugins: ["typescript", "typescript-resolvers"]
        }
    }
};
exports.default = config;
