import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:5000";

export default function Dashboard() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [scheduled, setScheduled] = useState([]);
    const [sent, setSent] = useState([]);

    const [activeTab, setActiveTab] =
        useState("scheduled");

    const [loading, setLoading] =
        useState(true);

    const [message, setMessage] =
        useState("");

    const [successMessage, setSuccessMessage] =
        useState("");

    // ==========================================
    // LOAD USER
    // ==========================================

    const loadUser = async () => {
        const response = await fetch(
            `${API}/api/auth/me`,
            {
                method: "GET",
                credentials: "include",
            }
        );

        if (response.status === 401) {
            navigate("/");
            return null;
        }

        if (!response.ok) {
            throw new Error(
                "Failed to load user"
            );
        }

        const data =
            await response.json();

        setUser(data.user);

        return data.user;
    };

    // ==========================================
    // LOAD SCHEDULED EMAILS
    // ==========================================

    const loadScheduledEmails = async () => {
        const response = await fetch(
            `${API}/api/emails/scheduled`,
            {
                method: "GET",
                credentials: "include",
            }
        );

        if (response.status === 401) {
            navigate("/");
            return;
        }

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Failed to load scheduled emails"
            );
        }

        setScheduled(
            Array.isArray(data)
                ? data
                : []
        );
    };

    // ==========================================
    // LOAD SENT EMAILS
    // ==========================================

    const loadSentEmails = async () => {
        const response = await fetch(
            `${API}/api/emails/sent`,
            {
                method: "GET",
                credentials: "include",
            }
        );

        if (response.status === 401) {
            navigate("/");
            return;
        }

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Failed to load sent emails"
            );
        }

        setSent(
            Array.isArray(data)
                ? data
                : []
        );
    };

    // ==========================================
    // LOAD DASHBOARD
    // ==========================================

    const loadDashboard = async () => {
        try {
            setLoading(true);
            setMessage("");

            await loadUser();

            await Promise.all([
                loadScheduledEmails(),
                loadSentEmails(),
            ]);
        } catch (error) {
            console.error(
                "Dashboard load error:",
                error
            );

            setMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to load dashboard"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, []);

    // ==========================================
    // LOGOUT
    // ==========================================

    const handleLogout = async () => {
        try {
            await fetch(
                `${API}/api/auth/logout`,
                {
                    method: "POST",
                    credentials: "include",
                }
            );
        } catch (error) {
            console.error(
                "Logout error:",
                error
            );
        } finally {
            navigate("/");
        }
    };

    // ==========================================
    // OPEN COMPOSE
    // ==========================================

    const openCompose = () => {
        navigate("/compose");
    };

    // ==========================================
    // CURRENT EMAILS
    // ==========================================

    const currentEmails =
        activeTab === "scheduled"
            ? scheduled
            : sent;

    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-sm text-gray-500">
                    Loading ReachInbox...
                </div>
            </div>
        );
    }

    // ==========================================
    // DASHBOARD
    // ==========================================

    return (
        <div className="min-h-screen bg-white flex text-[#202020]">

            {/* =====================================
                SIDEBAR
            ===================================== */}

            <aside className="w-[230px] shrink-0 border-r border-[#eeeeee] flex flex-col">

                {/* Logo */}

                <div className="px-5 pt-5">
                    <div className="text-[30px] font-black tracking-[-4px]">
                        ONE
                    </div>
                </div>

                {/* User */}

                <div className="px-3 mt-4">

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full bg-[#f3f6f4] rounded-2xl px-3 py-3 flex items-center gap-3 hover:bg-[#edf1ee] transition"
                    >

                        <div className="w-9 h-9 shrink-0 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">

                            {user?.avatar ? (
                                <img
                                    src={user.avatar}
                                    alt={
                                        user.name ||
                                        "User"
                                    }
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-sm font-semibold text-gray-600">
                                    {user?.name
                                        ?.charAt(0)
                                        ?.toUpperCase() ||
                                        "U"}
                                </span>
                            )}

                        </div>

                        <div className="flex-1 min-w-0 text-left">

                            <div className="text-sm font-medium truncate">
                                {user?.name ||
                                    "User"}
                            </div>

                            <div className="text-[10px] text-gray-400 truncate">
                                {user?.email || ""}
                            </div>

                        </div>

                        <span className="text-gray-400 text-xs">
                            ⌄
                        </span>

                    </button>

                </div>

                {/* Compose */}

                <div className="px-4 mt-4">

                    <button
                        type="button"
                        onClick={openCompose}
                        className="w-full h-9 rounded-full border border-[#00b83f] text-[#00a83f] text-sm font-medium hover:bg-[#f0fff5] transition"
                    >
                        Compose
                    </button>

                </div>

                {/* Navigation */}

                <div className="mt-7 px-3">

                    <div className="px-2 text-[11px] uppercase tracking-wide text-gray-400 mb-2">
                        Core
                    </div>

                    {/* Scheduled */}

                    <button
                        type="button"
                        onClick={() =>
                            setActiveTab(
                                "scheduled"
                            )
                        }
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                            activeTab ===
                            "scheduled"
                                ? "bg-[#e5f5ec] font-medium"
                                : "hover:bg-gray-50 text-gray-600"
                        }`}
                    >

                        <span>◷</span>

                        <span className="flex-1 text-left">
                            Scheduled
                        </span>

                        <span className="text-xs text-gray-500">
                            {scheduled.length}
                        </span>

                    </button>

                    {/* Sent */}

                    <button
                        type="button"
                        onClick={() =>
                            setActiveTab("sent")
                        }
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                            activeTab === "sent"
                                ? "bg-[#e5f5ec] font-medium"
                                : "hover:bg-gray-50 text-gray-600"
                        }`}
                    >

                        <span>➤</span>

                        <span className="flex-1 text-left">
                            Sent
                        </span>

                        <span className="text-xs text-gray-500">
                            {sent.length}
                        </span>

                    </button>

                </div>

            </aside>

            {/* =====================================
                MAIN
            ===================================== */}

            <main className="flex-1 min-w-0">

                {/* Header */}

                <div className="h-[65px] border-b border-[#eeeeee] flex items-center px-6 gap-4">

                    <div className="flex-1 max-w-[560px]">

                        <div className="h-10 bg-[#f4f6f5] rounded-full flex items-center px-4">

                            <span className="text-gray-400 text-sm mr-2">
                                ⌕
                            </span>

                            <input
                                type="text"
                                placeholder="Search"
                                className="flex-1 bg-transparent outline-none text-sm"
                            />

                        </div>

                    </div>

                    <button
                        type="button"
                        onClick={loadDashboard}
                        className="text-gray-400 hover:text-gray-600 text-xl"
                        title="Refresh"
                    >
                        ↻
                    </button>

                </div>

                {/* Success */}

                {successMessage && (
                    <div className="mx-6 mt-4 rounded-lg bg-green-50 border border-green-100 text-green-700 text-sm px-4 py-3">
                        {successMessage}
                    </div>
                )}

                {/* Error */}

                {message && (
                    <div className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3">
                        {message}
                    </div>
                )}

                {/* Page Header */}

                <div className="px-6 pt-5 pb-3 flex items-center justify-between">

                    <div>

                        <h2 className="text-lg font-semibold">
                            {activeTab ===
                            "scheduled"
                                ? "Scheduled"
                                : "Sent"}
                        </h2>

                        <p className="text-xs text-gray-400 mt-1">
                            {currentEmails.length}{" "}
                            email
                            {currentEmails.length ===
                            1
                                ? ""
                                : "s"}
                        </p>

                    </div>

                    <button
                        type="button"
                        onClick={openCompose}
                        className="px-4 py-2 bg-[#00b83f] text-white rounded-lg text-sm font-medium hover:bg-[#00a83f] transition"
                    >
                        New Email
                    </button>

                </div>

                {/* Email List */}

                <div>

                    {currentEmails.length ===
                    0 ? (

                        <div className="min-h-[350px] flex items-center justify-center">

                            <div className="text-center">

                                <div className="text-3xl text-gray-200 mb-3">
                                    ✉
                                </div>

                                <p className="text-sm text-gray-500">
                                    No{" "}
                                    {activeTab ===
                                    "scheduled"
                                        ? "scheduled"
                                        : "sent"}{" "}
                                    emails
                                </p>

                                <p className="text-xs text-gray-400 mt-1">
                                    Your emails will appear here.
                                </p>

                            </div>

                        </div>

                    ) : (

                        currentEmails.map(
                            (email) => (

                                <div
                                    key={email.id}
                                    onClick={() =>
                                        navigate(
                                            `/email/${email.id}`
                                        )
                                    }
                                    className="px-6 py-4 border-b border-[#f2f2f2] flex items-center gap-4 hover:bg-[#fafafa] transition cursor-pointer"
                                >

                                    {/* Recipient */}

                                    <div className="w-[190px] shrink-0">

                                        <div className="text-sm font-medium truncate">
                                            To:{" "}
                                            {email.to}
                                        </div>

                                    </div>

                                    {/* Subject */}

                                    <div className="flex-1 min-w-0">

                                        <div className="flex items-center gap-2">

                                            {activeTab ===
                                                "scheduled" &&
                                                email.scheduledAt && (
                                                    <span className="bg-[#fff0e6] text-[#f27b25] rounded-full px-3 py-1 text-[10px] whitespace-nowrap">
                                                        ◷{" "}
                                                        {new Date(
                                                            email.scheduledAt
                                                        ).toLocaleString()}
                                                    </span>
                                                )}

                                            {activeTab ===
                                                "sent" &&
                                                email.sentAt && (
                                                    <span className="bg-[#e7f6ee] text-[#00a83f] rounded-full px-3 py-1 text-[10px] whitespace-nowrap">
                                                        ✓{" "}
                                                        {new Date(
                                                            email.sentAt
                                                        ).toLocaleString()}
                                                    </span>
                                                )}

                                            <span className="font-medium text-sm truncate">
                                                {
                                                    email.subject
                                                }
                                            </span>

                                        </div>

                                        <div className="text-xs text-gray-400 truncate mt-1">
                                            {
                                                email.body
                                            }
                                        </div>

                                    </div>

                                    {/* Star */}

                                    <div className="text-gray-300 text-xl">
                                        ☆
                                    </div>

                                </div>

                            )
                        )

                    )}

                </div>

            </main>

        </div>
    );
}