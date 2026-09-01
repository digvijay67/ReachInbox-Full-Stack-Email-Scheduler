import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API = "http://localhost:5000";

function formatDate(dateValue) {
  if (!dateValue) return "-";

  return new Date(dateValue).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getInitials(name, fallback = "U") {
  if (!name) return fallback;
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function EmailDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadUser = async () => {
    try {
      const response = await fetch(`${API}/api/auth/me`, {
        method: "GET",
        credentials: "include",
      });

      if (response.status === 401) {
        navigate("/");
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      setUser(data.user);
      return data.user;
    } catch (error) {
      console.error("User load error:", error);
      return null;
    }
  };

  const loadEmail = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API}/api/emails/${id}`, {
        method: "GET",
        credentials: "include",
      });

      if (response.status === 401) {
        navigate("/");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Failed to load email");
        return;
      }

      setEmail(data);
    } catch (error) {
      console.error("Email details error:", error);
      setMessage("Unable to connect to backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadUser();
      loadEmail();
    }
  }, [id, navigate]);

  const handleDelete = async () => {
    if (!email) return;

    const confirmed = window.confirm(
      "This email will be permanently deleted from the database. Continue?"
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setMessage("");

      const response = await fetch(`${API}/api/emails/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete email");
      }

      navigate("/dashboard");
    } catch (error) {
      console.error("Delete email error:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to delete email"
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading email...</div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-red-500 mb-4">
            {message || "Email not found"}
          </div>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-lg bg-[#00b83f] text-white text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const senderName = email.sender?.name || "ReachInbox";
  const senderEmail = email.sender?.email || "noreply@reachinbox.app";
  const senderInitial = getInitials(senderName, "R");
  const bodyText = email.body || "";
  const bodyLooksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(bodyText);

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#202020]">
      <header className="h-[72px] bg-white border-b border-[#eeeeee] flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-base text-gray-600 hover:text-black transition"
            aria-label="Go back"
          >
            <span className="text-2xl leading-none">←</span>
          </button>

          <div className="text-lg font-semibold text-gray-800">
            Email Details
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-50"
            title="Delete email"
            aria-label="Delete email"
          >
            {deleting ? "..." : "🗑"}
          </button>

          <div className="w-9 h-9 rounded-full bg-[#e4f4ea] flex items-center justify-center overflow-hidden border border-[#dfeae2] shrink-0">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || "User"}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-sm font-semibold text-[#00a83f]">
                {getInitials(user?.name, "U")}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[980px] mx-auto px-6 py-8">
        <div className="bg-white border border-[#eeeeee] rounded-2xl shadow-sm overflow-hidden">

          <div className="px-7 py-6 border-b border-[#eeeeee]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-full bg-[#e5f5ec] text-[#00a83f] font-semibold flex items-center justify-center shrink-0">
                  {senderInitial}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-gray-800">
                      {senderName}
                    </span>
                    <span className="text-gray-400">
                      &lt;{senderEmail}&gt;
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-gray-500">
                    to {email.to}
                  </div>
                </div>

              </div>

              <div className="text-xs text-gray-400 whitespace-nowrap pt-1">
                {formatDate(email.sentAt || email.scheduledAt || email.createdAt)}
              </div>
            </div>
          </div>

          <div className="px-7 py-6 border-b border-[#eeeeee]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-gray-800 break-words">
                {email.subject || "(No subject)"}
              </div>

              <div>
                {email.status === "SENT" && (
                  <span className="inline-flex items-center rounded-full bg-[#e7f6ee] text-[#00a83f] px-3 py-1 text-xs font-medium">
                    ✓ Sent
                  </span>
                )}

                {email.status === "SCHEDULED" && (
                  <span className="inline-flex items-center rounded-full bg-[#fff0e6] text-[#f27b25] px-3 py-1 text-xs font-medium">
                    ◷ Scheduled
                  </span>
                )}

                {email.status === "PROCESSING" && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-600 px-3 py-1 text-xs font-medium">
                    Processing
                  </span>
                )}

                {email.status === "FAILED" && (
                  <span className="inline-flex items-center rounded-full bg-red-50 text-red-600 px-3 py-1 text-xs font-medium">
                    Failed
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="px-7 py-7">
            {bodyLooksLikeHtml ? (
              <div
                className="prose max-w-none text-[15px] leading-7 text-gray-700 [&_p]:mb-3 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_a]:text-[#00a83f] [&_a]:underline [&_br]:block [&_br]:h-2"
                dangerouslySetInnerHTML={{ __html: bodyText }}
              />
            ) : (
              <div className="max-w-none text-[15px] leading-7 text-gray-700 whitespace-pre-wrap break-words">
                {bodyText || "No email body available."}
              </div>
            )}
          </div>

          <div className="border-t border-[#eeeeee] px-7 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-xl bg-[#fafafa] border border-[#f0f0f0] p-4">
                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">
                  Recipient
                </div>
                <div className="text-sm font-medium text-gray-800 break-all">
                  {email.to}
                </div>
              </div>

              <div className="rounded-xl bg-[#fafafa] border border-[#f0f0f0] p-4">
                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">
                  Sender
                </div>
                <div className="text-sm font-medium text-gray-800 break-all">
                  {senderEmail}
                </div>
              </div>

              <div className="rounded-xl bg-[#fafafa] border border-[#f0f0f0] p-4">
                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">
                  Scheduled time
                </div>
                <div className="text-sm font-medium text-gray-800">
                  {formatDate(email.scheduledAt)}
                </div>
              </div>

              <div className="rounded-xl bg-[#fafafa] border border-[#f0f0f0] p-4">
                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">
                  Send time
                </div>
                <div className="text-sm font-medium text-gray-800">
                  {formatDate(email.sentAt)}
                </div>
              </div>

              <div className="rounded-xl bg-[#fafafa] border border-[#f0f0f0] p-4">
                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">
                  Created
                </div>
                <div className="text-sm font-medium text-gray-800">
                  {formatDate(email.createdAt)}
                </div>
              </div>

              <div className="rounded-xl bg-[#fafafa] border border-[#f0f0f0] p-4">
                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">
                  Updated
                </div>
                <div className="text-sm font-medium text-gray-800">
                  {formatDate(email.updatedAt)}
                </div>
              </div>
            </div>
          </div>

          {message && (
            <div className="px-7 pb-5">
              <div className="rounded-lg border border-red-100 bg-red-50 text-red-600 text-sm px-4 py-3">
                {message}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}