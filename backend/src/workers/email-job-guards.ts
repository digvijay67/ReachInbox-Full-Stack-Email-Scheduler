export type EmailJobRecord = {
  id: number;
  status?: string | null;
  jobId?: string | null;
};

export function shouldSkipDeletedEmail(
  email: EmailJobRecord | null | undefined
) {
  return !email;
}

export function canProcessEmail(
  email: EmailJobRecord | null | undefined
) {
  if (!email) {
    return false;
  }

  if (email.status === "SENT") {
    return false;
  }

  return true;
}
