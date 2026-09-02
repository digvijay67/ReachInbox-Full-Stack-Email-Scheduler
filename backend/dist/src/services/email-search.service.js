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
exports.indexEmail = indexEmail;
exports.deleteEmailFromIndex = deleteEmailFromIndex;
exports.searchEmails = searchEmails;
const elasticsearch_1 = require("../lib/elasticsearch");
const VALID_STATUSES = new Set([
    "SCHEDULED",
    "PROCESSING",
    "SENT",
    "FAILED",
]);
function indexEmail(email) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield elasticsearch_1.esClient.index({
                index: elasticsearch_1.EMAIL_INDEX,
                id: String(email.id),
                document: {
                    id: email.id,
                    userId: email.userId,
                    senderId: email.senderId,
                    to: email.to,
                    subject: email.subject,
                    body: email.body,
                    status: email.status,
                    scheduledAt: email.scheduledAt,
                    sentAt: email.sentAt,
                    createdAt: email.createdAt,
                    updatedAt: email.updatedAt,
                },
            });
        }
        catch (error) {
            console.error(`Failed to index email ${email.id}:`, error instanceof Error
                ? error.message
                : error);
        }
    });
}
function deleteEmailFromIndex(emailId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            yield elasticsearch_1.esClient.delete({
                index: elasticsearch_1.EMAIL_INDEX,
                id: String(emailId),
            });
        }
        catch (error) {
            const status = (_a = error === null || error === void 0 ? void 0 : error.meta) === null || _a === void 0 ? void 0 : _a.statusCode;
            if (status !== 404) {
                console.error(`Failed to delete email ${emailId}:`, error instanceof Error
                    ? error.message
                    : error);
            }
        }
    });
}
function searchEmails(_a) {
    return __awaiter(this, arguments, void 0, function* ({ userId, query, status, dateFrom, dateTo, from = 0, size = 20, }) {
        // ------------------------------------
        // FILTERS
        // ------------------------------------
        var _b;
        var _c;
        const filter = [
            {
                term: {
                    userId,
                },
            },
        ];
        // ------------------------------------
        // STATUS FILTER
        // ------------------------------------
        if (status) {
            const normalizedStatus = status.toUpperCase();
            if (!VALID_STATUSES.has(normalizedStatus)) {
                throw new Error(`Invalid status "${status}". Must be one of: ${[
                    ...VALID_STATUSES,
                ].join(", ")}`);
            }
            filter.push({
                term: {
                    status: normalizedStatus,
                },
            });
        }
        // ------------------------------------
        // DATE FILTER
        // ------------------------------------
        if (dateFrom || dateTo) {
            const range = {};
            if (dateFrom) {
                const parsed = new Date(dateFrom);
                if (Number.isNaN(parsed.getTime())) {
                    throw new Error(`Invalid dateFrom "${dateFrom}"`);
                }
                range.gte =
                    parsed.toISOString();
            }
            if (dateTo) {
                const parsed = new Date(dateTo);
                if (Number.isNaN(parsed.getTime())) {
                    throw new Error(`Invalid dateTo "${dateTo}"`);
                }
                range.lte =
                    parsed.toISOString();
            }
            filter.push({
                range: {
                    scheduledAt: range,
                },
            });
        }
        // ------------------------------------
        // SEARCH QUERY
        // ------------------------------------
        const trimmedQuery = query === null || query === void 0 ? void 0 : query.trim();
        const must = trimmedQuery
            ? [
                {
                    multi_match: {
                        query: trimmedQuery,
                        fields: [
                            "subject^3",
                            "to^2",
                            "body",
                        ],
                        fuzziness: "AUTO",
                    },
                },
            ]
            : [
                {
                    match_all: {},
                },
            ];
        // ------------------------------------
        // ELASTICSEARCH SEARCH
        // ------------------------------------
        const result = yield elasticsearch_1.esClient.search({
            index: elasticsearch_1.EMAIL_INDEX,
            from,
            size,
            query: {
                bool: {
                    must,
                    filter,
                },
            },
            // Search -> relevance
            // No search -> newest first
            sort: trimmedQuery
                ? [
                    {
                        _score: {
                            order: "desc",
                        },
                    },
                ]
                : [
                    {
                        scheduledAt: {
                            order: "desc",
                        },
                    },
                ],
            // ------------------------------------
            // HIGHLIGHT
            // ------------------------------------
            highlight: trimmedQuery
                ? {
                    fields: {
                        subject: {},
                        to: {},
                        body: {
                            fragment_size: 150,
                            number_of_fragments: 1,
                        },
                    },
                    pre_tags: ["<mark>"],
                    post_tags: ["</mark>"],
                }
                : undefined,
        });
        // ------------------------------------
        // TOTAL
        // ------------------------------------
        const total = typeof result.hits.total ===
            "number"
            ? result.hits.total
            : (_c = (_b = result.hits.total) === null || _b === void 0 ? void 0 : _b.value) !== null && _c !== void 0 ? _c : 0;
        const totalPages = size > 0
            ? Math.ceil(total / size)
            : 0;
        // ------------------------------------
        // HITS
        // ------------------------------------
        const rawHits = result.hits.hits;
        const hits = rawHits
            .filter((hit) => hit._source !== undefined)
            .map((hit) => (Object.assign(Object.assign({}, hit._source), { highlight: hit.highlight })));
        return {
            total,
            totalPages,
            hits,
        };
    });
}
