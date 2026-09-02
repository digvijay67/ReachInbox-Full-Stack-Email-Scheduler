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
Object.defineProperty(exports, "__esModule", { value: true });
exports.esClient = exports.EMAIL_INDEX = void 0;
exports.ensureEmailIndex = ensureEmailIndex;
const elasticsearch_1 = require("@elastic/elasticsearch");
exports.EMAIL_INDEX = process.env.ELASTIC_EMAIL_INDEX ||
    "emails";
exports.esClient = new elasticsearch_1.Client({
    node: process.env.ELASTICSEARCH_URL ||
        "http://localhost:9200",
});
function ensureEmailIndex() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const exists = yield exports.esClient.indices.exists({
                index: exports.EMAIL_INDEX,
            });
            if (exists) {
                return;
            }
            yield exports.esClient.indices.create({
                index: exports.EMAIL_INDEX,
                mappings: {
                    properties: {
                        id: {
                            type: "integer",
                        },
                        userId: {
                            type: "integer",
                        },
                        senderId: {
                            type: "integer",
                        },
                        to: {
                            type: "text",
                        },
                        subject: {
                            type: "text",
                        },
                        body: {
                            type: "text",
                        },
                        status: {
                            type: "keyword",
                        },
                        scheduledAt: {
                            type: "date",
                        },
                        sentAt: {
                            type: "date",
                        },
                        createdAt: {
                            type: "date",
                        },
                        updatedAt: {
                            type: "date",
                        },
                    },
                },
            });
            console.log(`Elasticsearch index "${exports.EMAIL_INDEX}" created`);
        }
        catch (error) {
            console.error("Failed to ensure Elasticsearch index:", error instanceof Error
                ? error.message
                : error);
        }
    });
}
