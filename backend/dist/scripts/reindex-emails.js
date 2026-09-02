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
require("dotenv/config");
const prisma_1 = require("../lib/prisma");
const elasticsearch_1 = require("../lib/elasticsearch");
const email_search_service_1 = require("../services/email-search.service");
const BATCH_SIZE = 500;
function reindexAll() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, elasticsearch_1.ensureEmailIndex)();
        let cursor;
        let totalIndexed = 0;
        while (true) {
            const emails = yield prisma_1.prisma.email.findMany(Object.assign({ take: BATCH_SIZE, orderBy: {
                    id: "asc",
                } }, (cursor !== undefined
                ? {
                    skip: 1,
                    cursor: {
                        id: cursor,
                    },
                }
                : {})));
            if (emails.length === 0) {
                break;
            }
            for (const email of emails) {
                yield (0, email_search_service_1.indexEmail)(email);
                totalIndexed++;
            }
            cursor = emails[emails.length - 1].id;
            console.log(`Indexed ${totalIndexed} emails so far...`);
        }
        console.log(`Done. Reindexed ${totalIndexed} emails into Elasticsearch.`);
    });
}
reindexAll()
    .catch((error) => {
    console.error("Reindex failed:", error);
    process.exitCode = 1;
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma_1.prisma.$disconnect();
}));
