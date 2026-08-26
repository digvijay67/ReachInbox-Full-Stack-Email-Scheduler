import { prisma } from "../lib/prisma";
import { googleOAuth2Client } from "../lib/google";

export async function getGoogleAccessToken(
  senderId: number
): Promise<string> {
  const sender =
    await prisma.sender.findUnique({
      where: {
        id: senderId,
      },
    });

  if (!sender) {
    throw new Error("Sender not found");
  }

  if (!sender.accessToken) {
    throw new Error(
      "Google access token not found"
    );
  }

  googleOAuth2Client.setCredentials({
    access_token: sender.accessToken,

    refresh_token:
      sender.refreshToken || undefined,
  });

  try {
    const { token } =
      await googleOAuth2Client.getAccessToken();

    if (!token) {
      throw new Error(
        "Unable to get Google access token"
      );
    }

    // ----------------------------------------
    // Save refreshed access token
    // ----------------------------------------

    if (token !== sender.accessToken) {
      await prisma.sender.update({
        where: {
          id: sender.id,
        },

        data: {
          accessToken: token,
        },
      });

      console.log(
        `Access token refreshed for sender ${sender.id}`
      );
    }

    return token;
  } catch (error) {
    console.error(
      "Google token error:",
      error
    );

    throw new Error(
      "Google authorization expired. Please login again."
    );
  }
}