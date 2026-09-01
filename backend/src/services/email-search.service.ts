import {
  esClient,
  EMAIL_INDEX,
} from "../lib/elasticsearch";

type IndexableEmail = {
  id: number;
  userId: number;
  senderId: number;
  to: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type EmailDocument = {
  id: number;
  userId: number;
  senderId: number;
  to: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string | Date;
  sentAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

const VALID_STATUSES = new Set([
  "SCHEDULED",
  "PROCESSING",
  "SENT",
  "FAILED",
]);

export async function indexEmail(
  email: IndexableEmail
) {
  try {
    await esClient.index({
      index: EMAIL_INDEX,
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
  } catch (error) {
    console.error(
      `Failed to index email ${email.id}:`,
      error instanceof Error
        ? error.message
        : error
    );
  }
}

export async function deleteEmailFromIndex(
  emailId: number
) {
  try {
    await esClient.delete({
      index: EMAIL_INDEX,
      id: String(emailId),
    });
  } catch (error) {
    const status = (
      error as {
        meta?: {
          statusCode?: number;
        };
      }
    )?.meta?.statusCode;

    if (status !== 404) {
      console.error(
        `Failed to delete email ${emailId}:`,
        error instanceof Error
          ? error.message
          : error
      );
    }
  }
}

export type EmailSearchParams = {
  userId: number;
  query?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  from?: number;
  size?: number;
};

export type EmailSearchResult = {
  total: number;
  totalPages: number;

  hits: Array<
    EmailDocument & {
      highlight?: {
        subject?: string[];
        to?: string[];
        body?: string[];
      };
    }
  >;
};

export async function searchEmails({
  userId,
  query,
  status,
  dateFrom,
  dateTo,
  from = 0,
  size = 20,
}: EmailSearchParams): Promise<EmailSearchResult> {
  // ------------------------------------
  // FILTERS
  // ------------------------------------

  const filter: Record<string, unknown>[] = [
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
    const normalizedStatus =
      status.toUpperCase();

    if (
      !VALID_STATUSES.has(
        normalizedStatus
      )
    ) {
      throw new Error(
        `Invalid status "${status}". Must be one of: ${[
          ...VALID_STATUSES,
        ].join(", ")}`
      );
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
    const range: Record<
      string,
      string
    > = {};

    if (dateFrom) {
      const parsed = new Date(dateFrom);

      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        throw new Error(
          `Invalid dateFrom "${dateFrom}"`
        );
      }

      range.gte =
        parsed.toISOString();
    }

    if (dateTo) {
      const parsed = new Date(dateTo);

      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        throw new Error(
          `Invalid dateTo "${dateTo}"`
        );
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

  const trimmedQuery =
    query?.trim();

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

  const result =
    await esClient.search({
      index: EMAIL_INDEX,

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

  const total =
    typeof result.hits.total ===
    "number"
      ? result.hits.total
      : result.hits.total?.value ??
        0;

  const totalPages =
    size > 0
      ? Math.ceil(
          total / size
        )
      : 0;

  // ------------------------------------
  // HITS
  // ------------------------------------

  const rawHits =
    result.hits.hits as Array<{
      _source?: EmailDocument;

      highlight?: {
        subject?: string[];
        to?: string[];
        body?: string[];
      };
    }>;

  const hits = rawHits
    .filter(
      (
        hit
      ): hit is typeof hit & {
        _source: EmailDocument;
      } =>
        hit._source !== undefined
    )
    .map((hit) => ({
      ...hit._source,
      highlight: hit.highlight,
    }));

  return {
    total,
    totalPages,
    hits,
  };
}