import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API = "http://localhost:5000";

export default function EmailDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadEmail = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        `${API}/api/emails/${id}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (response.status === 401) {
        window.location.href = "/";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Failed to load email"
        );
        return;
      }

      setEmail(data);
    } catch (error) {
      console.error(
        "Email details error:",
        error
      );

      setMessage(
        "Unable to connect to backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadEmail();
    }
  }, [id]);

  const formatDate = (date) => {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleString(
      undefined,
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-sm text-gray-500">
          Loading email...
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#202020]">

      {/* Header */}

      <div className="h-[65px] bg-white border-b border-[#eeeeee] flex items-center px-6">

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition"
        >
          <span className="text-lg">
            ←
          </span>

          Back
        </button>

        <div className="ml-5 text-lg font-semibold">
          Email Details
        </div>
      </div>

      {/* Main */}

      <main className="max-w-[900px] mx-auto px-6 py-8">

        {/* Email card */}

        <div className="bg-white border border-[#eeeeee] rounded-2xl shadow-sm overflow-hidden">

          {/* Subject Header */}

          <div className="px-7 py-6 border-b border-[#eeeeee]">

            <div className="flex items-start justify-between gap-5">

              <div className="min-w-0">

                <h1 className="text-xl font-semibold break-words">
                  {email.subject || "(No subject)"}
                </h1>

                <div className="mt-2 text-xs text-gray-400">
                  Email ID: {email.id}
                </div>

              </div>

              {/* Status */}

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

          {/* Sender / Receiver */}

          <div className="px-7 py-6 border-b border-[#eeeeee]">

            {/* From */}

            <div className="flex items-start gap-4">

              <div className="w-10 h-10 shrink-0 rounded-full bg-[#e5f5ec] flex items-center justify-center">
                <span className="text-sm font-semibold text-[#00a83f]">
                  {(email.sender?.name ||
                    email.sender?.email ||
                    "R")
                    .charAt(0)
                    .toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">

                <div className="flex flex-wrap items-center gap-2">

                  <span className="text-sm font-semibold">
                    {email.sender?.name ||
                      "ReachInbox"}
                  </span>

                  <span className="text-xs text-gray-400">
                    &lt;
                    {email.sender?.email ||
                      "treva.gleason52@ethereal.email"}
                    &gt;
                  </span>

                </div>

                <div className="mt-1 text-xs text-gray-400">
                  From
                </div>

              </div>
            </div>

            {/* To */}

            <div className="mt-6 flex items-start gap-4">

              <div className="w-10 h-10 shrink-0 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-sm font-semibold text-gray-500">
                  To
                </span>
              </div>

              <div className="flex-1 min-w-0">

                <div className="text-sm font-medium break-all">
                  {email.to}
                </div>

                <div className="mt-1 text-xs text-gray-400">
                  Recipient
                </div>

              </div>
            </div>

          </div>

          {/* Date information */}

          <div className="px-7 py-5 border-b border-[#eeeeee]">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* Scheduled */}

              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400">
                  Scheduled At
                </div>

                <div className="mt-1 text-sm font-medium">
                  {formatDate(
                    email.scheduledAt
                  )}
                </div>
              </div>

              {/* Sent */}

              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400">
                  Sent At
                </div>

                <div className="mt-1 text-sm font-medium">
                  {formatDate(
                    email.sentAt
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* Message */}

          <div className="px-7 py-7">

            <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-4">
              Message
            </div>

            <div className="text-sm text-gray-700 leading-7 whitespace-pre-wrap break-words">
              {email.body || "(No message)"}
            </div>

          </div>

          {/* Error */}

          {email.error && (
            <div className="mx-7 mb-7 rounded-xl bg-red-50 border border-red-100 px-4 py-3">

              <div className="text-xs font-semibold text-red-600 mb-1">
                Error
              </div>

              <div className="text-sm text-red-600 break-words">
                {email.error}
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}