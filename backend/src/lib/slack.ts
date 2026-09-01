import "dotenv/config";

import { prisma } from "./prisma";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || "";
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || "";
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI || "";

/**
 * Builds the Slack "Add to Slack" authorize URL.
 *
 * Uses the `incoming-webhook` scope, which lets the installing
 * user pick a specific channel during the OAuth consent screen
 * and hands back a ready-to-POST webhook URL for that channel —
 * simplest way to satisfy "stores the token/webhook per user".
 *
 * `state` carries our own userId through the redirect so the
 * callback knows which ReachInbox user to attach this to.
 */
export function buildSlackAuthorizeUrl(userId: number): string {
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: "incoming-webhook",
    redirect_uri: SLACK_REDIRECT_URI,
    state: String(userId),
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

type SlackOAuthResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: {
    id: string;
    name: string;
  };
  incoming_webhook?: {
    url: string;
    channel: string;
  };
};

/**
 * Exchanges the OAuth `code` from Slack's redirect for a real
 * incoming webhook URL, and stores it against the given user.
 * Upserts, so reconnecting simply replaces the old webhook.
 */
export async function exchangeSlackCode(
  code: string,
  userId: number
) {
  const response = await fetch(
    "https://slack.com/api/oauth.v2.access",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: SLACK_REDIRECT_URI,
      }),
    }
  );

  const data =
    (await response.json()) as SlackOAuthResponse;

  if (!data.ok || !data.incoming_webhook) {
    throw new Error(
      `Slack OAuth exchange failed: ${data.error || "unknown error"
      }`
    );
  }

  await prisma.slackIntegration.upsert({
    where: {
      userId,
    },

    create: {
      userId,
      teamId: data.team?.id || "",
      teamName: data.team?.name || null,
      incomingWebhookUrl:
        data.incoming_webhook.url,
      channel: data.incoming_webhook.channel,
    },

    update: {
      teamId: data.team?.id || "",
      teamName: data.team?.name || null,
      incomingWebhookUrl:
        data.incoming_webhook.url,
      channel: data.incoming_webhook.channel,
    },
  });
}

export async function disconnectSlack(
  userId: number
) {
  await prisma.slackIntegration
    .delete({
      where: {
        userId,
      },
    })
    .catch(() => {
      // Already disconnected — nothing to do.
    });
}

/**
 * Sends a live Slack message to the given user's connected
 * workspace, IF they have one connected.
 *
 * Safe by design:
 *   - No integration found -> silently does nothing, no crash.
 *   - Slack API call fails -> logged, swallowed, never thrown —
 *     a Slack outage must never block or fail an email send.
 */
export async function notifySlack(
  userId: number,
  text: string
) {
  try {
    const integration =
      await prisma.slackIntegration.findUnique({
        where: {
          userId,
        },
      });

    if (!integration) {
      // User hasn't connected Slack. Not an error.
      return;
    }

    const response = await fetch(
      integration.incomingWebhookUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      }
    );
    const responseBody = await response.text();

    console.log("========== SLACK RESPONSE ==========");
    console.log("Status:", response.status);
    console.log("Body:", responseBody);
    console.log("====================================");

    if (!response.ok) {
      
      console.error(
        `Slack notification failed (${response.status}):`,
        responseBody
      );
    }
  } catch (error) {
    console.error(
      "Slack notification error:",
      error instanceof Error
        ? error.message
        : error
    );
  }
}