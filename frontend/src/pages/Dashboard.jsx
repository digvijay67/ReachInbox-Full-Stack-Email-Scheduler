import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:5000";
const SEARCH_DEBOUNCE_MS = 350;

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

    const [slackConnected, setSlackConnected] = useState(false);
    const [slackLoading, setSlackLoading] = useState(false);
    const [slackMessage, setSlackMessage] = useState("");

    // ==========================================
    // SEARCH STATE
    // ==========================================

    const [searchQuery, setSearchQuery] =
        useState("");

    const [searchResults, setSearchResults] =
        useState(null);
    // null = no search active (show tab view)
    // [] or [...] = search active (show search results view)

    const [searching, setSearching] =
        useState(false);

    const [searchError, setSearchError] =
        useState("");

    const [profileOpen, setProfileOpen] = useState(false);

    const searchDebounceRef = useRef(null);
    const searchRequestId = useRef(0);

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
                checkSlackStatus(),
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
    // SEARCH EMAILS (Elasticsearch)
    // ==========================================

    const runSearch = async (query) => {
        const trimmed = query.trim();

        if (!trimmed) {
            setSearchResults(null);
            setSearchError("");
            setSearching(false);
            return;
        }

        // Guard against out-of-order responses:
        // only the latest request is allowed to update state.
        const requestId = ++searchRequestId.current;

        try {
            setSearching(true);
            setSearchError("");

            const params = new URLSearchParams({
                q: trimmed,
            });

            const response = await fetch(
                `${API}/api/emails/search?${params.toString()}`,
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
                    "Search failed"
                );
            }

            // Ignore stale responses from an older keystroke.
            if (
                requestId !==
                searchRequestId.current
            ) {
                return;
            }

            setSearchResults(
                Array.isArray(data.results)
                    ? data.results
                    : []
            );
        } catch (error) {
            if (
                requestId !==
                searchRequestId.current
            ) {
                return;
            }

            console.error(
                "Search error:",
                error
            );

            setSearchError(
                error instanceof Error
                    ? error.message
                    : "Search failed"
            );

            setSearchResults([]);
        } finally {
            if (
                requestId ===
                searchRequestId.current
            ) {
                setSearching(false);
            }
        }
    };

    const handleSearchChange = (event) => {
        const value = event.target.value;

        setSearchQuery(value);

        if (searchDebounceRef.current) {
            clearTimeout(
                searchDebounceRef.current
            );
        }

        searchDebounceRef.current =
            setTimeout(() => {
                runSearch(value);
            }, SEARCH_DEBOUNCE_MS);
    };

    const clearSearch = () => {
        if (searchDebounceRef.current) {
            clearTimeout(
                searchDebounceRef.current
            );
        }

        searchRequestId.current += 1;

        setSearchQuery("");
        setSearchResults(null);
        setSearchError("");
        setSearching(false);
    };

    useEffect(() => {
        return () => {
            if (searchDebounceRef.current) {
                clearTimeout(
                    searchDebounceRef.current
                );
            }
        };
    }, []);

    const isSearchActive =
        searchResults !== null;


    // ==========================================
    // SLACK
    // ==========================================

    const checkSlackStatus = async () => {
        try {
            const response = await fetch(
                `${API}/api/slack/status`,
                {
                    method: "GET",
                    credentials: "include",
                }
            );

            if (response.status === 401) {
                navigate("/");
                return;
            }

            if (!response.ok) {
                return;
            }

            const data = await response.json();

            setSlackConnected(
                Boolean(
                    data.connected ??
                    data.slackConnected
                )
            );
        } catch (error) {
            console.error(
                "Slack status error:",
                error
            );
        }
    };

    const connectSlack = () => {
        window.location.href =
            `${API}/api/slack/connect`;
    };

    const disconnectSlack = async () => {
        try {
            setSlackLoading(true);
            setSlackMessage("");

            const response = await fetch(
                `${API}/api/slack/disconnect`,
                {
                    method: "POST",
                    credentials: "include",
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to disconnect Slack"
                );
            }

            setSlackConnected(false);
            setSlackMessage(
                "Slack disconnected."
            );
        } catch (error) {
            console.error(
                "Slack disconnect error:",
                error
            );

            setSlackMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to disconnect Slack."
            );
        } finally {
            setSlackLoading(false);
        }
    };

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

    const currentEmails = isSearchActive
        ? searchResults
        : activeTab === "scheduled"
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

                
                {/* =====================================
    PROFILE
===================================== */}

                <div className="px-3 mt-4 relative">

                    {/* Profile Button */}

                    <button
                        type="button"
                        onClick={() =>
                            setProfileOpen((prev) => !prev)
                        }
                        className="w-full bg-[#f3f6f4] rounded-2xl px-3 py-3 flex items-center gap-3 hover:bg-[#edf1ee] transition"
                    >

                        {/* Google Avatar */}

                        <div className="w-9 h-9 shrink-0 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">

                            {user?.avatar ? (
                                <img
                                    src={user.avatar}
                                    alt={user.name || "User"}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <span className="text-sm font-semibold text-gray-600">
                                    {user?.name
                                        ?.charAt(0)
                                        ?.toUpperCase() || "U"}
                                </span>
                            )}

                        </div>


                        {/* Name + Email */}

                        <div className="flex-1 min-w-0 text-left">

                            <div className="text-sm font-medium truncate">
                                {user?.name || "User"}
                            </div>

                            <div className="text-[10px] text-gray-400 truncate">
                                {user?.email || ""}
                            </div>

                        </div>


                        {/* Arrow */}

                        <span
                            className={`text-gray-400 text-xs transition-transform ${profileOpen
                                    ? "rotate-180"
                                    : ""
                                }`}
                        >
                            ⌄
                        </span>

                    </button>


                    {/* =====================================
        PROFILE DROPDOWN
    ===================================== */}

                    {profileOpen && (

                        <div className="absolute left-3 right-3 top-full mt-2 z-50">

                            <div className="bg-white border border-[#eeeeee] rounded-xl shadow-lg overflow-hidden">

                                {/* Profile Info */}

                                <div className="px-4 py-3 border-b border-[#eeeeee]">

                                    <div className="flex items-center gap-3">

                                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center shrink-0">

                                            {user?.avatar ? (
                                                <img
                                                    src={user.avatar}
                                                    alt={
                                                        user.name ||
                                                        "User"
                                                    }
                                                    className="w-full h-full object-cover"
                                                    referrerPolicy="no-referrer"
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


                                        <div className="min-w-0">

                                            <div className="text-sm font-semibold truncate">
                                                {user?.name ||
                                                    "User"}
                                            </div>

                                            <div className="text-[11px] text-gray-400 truncate">
                                                {user?.email ||
                                                    ""}
                                            </div>

                                        </div>

                                    </div>

                                </div>


                                {/* Logout */}

                                <button
                                    type="button"
                                    onClick={async () => {
                                        setProfileOpen(false);
                                        await handleLogout();
                                    }}
                                    className="w-full px-4 py-3 flex items-center gap-3 text-sm text-red-500 hover:bg-red-50 transition"
                                >

                                    <span className="text-base">
                                        ↪
                                    </span>

                                    <span>
                                        Logout
                                    </span>

                                </button>

                            </div>

                        </div>

                    )}

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

                {/* Slack */}

                <div className="px-4 mt-5">

                    <div className="border border-[#eeeeee] rounded-xl p-3">

                        <div className="flex items-center gap-2 mb-2">

                            <div className="w-7 h-7 rounded-lg bg-[#4A154B] flex items-center justify-center text-white text-xs font-bold">
                                #
                            </div>

                            <div className="flex-1 min-w-0">

                                <div className="text-xs font-semibold">
                                    Slack
                                </div>

                                <div className="text-[10px] text-gray-400">
                                    {slackConnected
                                        ? "Connected"
                                        : "Not connected"}
                                </div>

                            </div>

                            <div
                                className={`w-2 h-2 rounded-full ${slackConnected
                                    ? "bg-[#00b83f]"
                                    : "bg-gray-300"
                                    }`}
                            />

                        </div>

                        {!slackConnected ? (

                            <button
                                type="button"
                                onClick={connectSlack}
                                className="w-full h-8 rounded-lg bg-[#4A154B] text-white text-xs font-medium hover:opacity-90 transition"
                            >
                                Connect Slack
                            </button>

                        ) : (

                            <button
                                type="button"
                                onClick={disconnectSlack}
                                disabled={slackLoading}
                                className="w-full h-8 rounded-lg border border-gray-200 text-gray-600 text-xs hover:bg-gray-50 transition disabled:opacity-50"
                            >
                                {slackLoading
                                    ? "Disconnecting..."
                                    : "Disconnect Slack"}
                            </button>

                        )}

                        {slackMessage && (
                            <div className="mt-2 text-[10px] text-gray-500">
                                {slackMessage}
                            </div>
                        )}

                    </div>

                </div>

                {/* Navigation */}

                <div className="mt-7 px-3">

                    <div className="px-2 text-[11px] uppercase tracking-wide text-gray-400 mb-2">
                        Core
                    </div>

                    {/* Scheduled */}

                    <button
                        type="button"
                        onClick={() => {
                            clearSearch();
                            setActiveTab(
                                "scheduled"
                            );
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${activeTab ===
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
                        onClick={() => {
                            clearSearch();
                            setActiveTab("sent");
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${activeTab === "sent"
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
                                value={searchQuery}
                                onChange={
                                    handleSearchChange
                                }
                                placeholder="Search emails by subject, recipient, or body"
                                className="flex-1 bg-transparent outline-none text-sm"
                            />

                            {searching && (
                                <span className="text-[10px] text-gray-400 ml-2 whitespace-nowrap">
                                    Searching...
                                </span>
                            )}

                            {!searching &&
                                searchQuery && (
                                    <button
                                        type="button"
                                        onClick={
                                            clearSearch
                                        }
                                        className="text-gray-400 hover:text-gray-600 text-sm ml-2"
                                        title="Clear search"
                                    >
                                        ×
                                    </button>
                                )}

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

                {/* Search error */}

                {searchError && (
                    <div className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3">
                        {searchError}
                    </div>
                )}

                {/* Page Header */}

                <div className="px-6 pt-5 pb-3 flex items-center justify-between">

                    <div>

                        <h2 className="text-lg font-semibold">
                            {isSearchActive
                                ? `Search results for "${searchQuery}"`
                                : activeTab ===
                                    "scheduled"
                                    ? "Scheduled"
                                    : "Sent"}
                        </h2>

                        <p className="text-xs text-gray-400 mt-1">
                            {searching
                                ? "Searching..."
                                : `${currentEmails.length} email${currentEmails.length ===
                                    1
                                    ? ""
                                    : "s"
                                }`}
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

                    {searching && currentEmails.length === 0 ? (

                        <div className="min-h-[350px] flex items-center justify-center">
                            <div className="text-sm text-gray-400">
                                Searching...
                            </div>
                        </div>

                    ) : currentEmails.length ===
                        0 ? (

                        <div className="min-h-[350px] flex items-center justify-center">

                            <div className="text-center">

                                <div className="text-3xl text-gray-200 mb-3">
                                    ✉
                                </div>

                                <p className="text-sm text-gray-500">
                                    {isSearchActive
                                        ? `No emails match "${searchQuery}"`
                                        : `No ${activeTab ===
                                            "scheduled"
                                            ? "scheduled"
                                            : "sent"
                                        } emails`}
                                </p>

                                <p className="text-xs text-gray-400 mt-1">
                                    {isSearchActive
                                        ? "Try a different keyword."
                                        : "Your emails will appear here."}
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

                                            {isSearchActive &&
                                                email.status && (
                                                    <span
                                                        className={`rounded-full px-3 py-1 text-[10px] whitespace-nowrap ${email.status ===
                                                            "SENT"
                                                            ? "bg-[#e7f6ee] text-[#00a83f]"
                                                            : email.status ===
                                                                "FAILED"
                                                                ? "bg-red-50 text-red-500"
                                                                : "bg-[#fff0e6] text-[#f27b25]"
                                                            }`}
                                                    >
                                                        {
                                                            email.status
                                                        }
                                                    </span>
                                                )}

                                            {!isSearchActive &&
                                                activeTab ===
                                                "scheduled" &&
                                                email.scheduledAt && (
                                                    <span className="bg-[#fff0e6] text-[#f27b25] rounded-full px-3 py-1 text-[10px] whitespace-nowrap">
                                                        ◷{" "}
                                                        {new Date(
                                                            email.scheduledAt
                                                        ).toLocaleString()}
                                                    </span>
                                                )}

                                            {!isSearchActive &&
                                                activeTab ===
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