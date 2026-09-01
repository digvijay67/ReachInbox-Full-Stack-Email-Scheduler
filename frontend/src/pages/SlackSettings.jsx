import { useEffect, useState } from "react";

const API = "http://localhost:5000";

export default function SlackSettings() {
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // Check Slack connection status
    useEffect(() => {
        const checkSlackStatus = async () => {
            try {
                setLoading(true);
                setError("");

                const response = await fetch(
                    `${API}/api/slack/status`,
                    {
                        method: "GET",
                        credentials: "include",
                    }
                );

                if (response.status === 401) {
                    window.location.href = "/";
                    return;
                }

                if (!response.ok) {
                    throw new Error(
                        "Unable to check Slack connection."
                    );
                }

                const data = await response.json();

                setConnected(
                    Boolean(
                        data.connected
                    )
                );
            } catch (error) {
                console.error(
                    "Slack status error:",
                    error
                );

                setError(
                    "Unable to check Slack status."
                );
            } finally {
                setLoading(false);
            }
        };

        checkSlackStatus();
    }, []);

    // Connect Slack
    const handleConnect = () => {
        window.location.href =
            `${API}/api/slack/connect`;
    };

    // Disconnect Slack
    const handleDisconnect = async () => {
        try {
            setError("");
            setMessage("");

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
                        "Failed to disconnect Slack."
                );
            }

            setConnected(false);

            setMessage(
                "Slack disconnected successfully."
            );
        } catch (error) {
            console.error(
                "Slack disconnect error:",
                error
            );

            setError(
                error instanceof Error
                    ? error.message
                    : "Failed to disconnect Slack."
            );
        }
    };

    if (loading) {
        return (
            <div className="bg-white border border-[#eeeeee] rounded-2xl p-6">
                <div className="text-sm text-gray-400">
                    Checking Slack connection...
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-[#eeeeee] rounded-2xl overflow-hidden">

            {/* Header */}

            <div className="px-6 py-5 border-b border-[#eeeeee]">

                <div className="flex items-center gap-3">

                    <div className="w-10 h-10 rounded-xl bg-[#4A154B] flex items-center justify-center">
                        <span className="text-white font-bold">
                            #
                        </span>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold">
                            Slack
                        </h3>

                        <p className="text-xs text-gray-400 mt-1">
                            Get notifications when your
                            email sending limit is reached.
                        </p>
                    </div>

                </div>

            </div>

            {/* Content */}

            <div className="px-6 py-6">

                {error && (
                    <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="mb-4 rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">
                        {message}
                    </div>
                )}

                {!connected ? (

                    <div>

                        <div className="flex items-center gap-2 mb-4">

                            <span className="w-2 h-2 rounded-full bg-red-500" />

                            <span className="text-sm font-medium">
                                Not Connected
                            </span>

                        </div>

                        <p className="text-sm text-gray-500 leading-6 mb-5">
                            Connect your Slack workspace to
                            receive an alert when your hourly
                            email sending limit is reached.
                        </p>

                        <button
                            type="button"
                            onClick={handleConnect}
                            className="px-5 py-2.5 rounded-lg bg-[#4A154B] text-white text-sm font-medium hover:opacity-90 transition"
                        >
                            Connect Slack
                        </button>

                    </div>

                ) : (

                    <div>

                        <div className="flex items-center gap-2 mb-4">

                            <span className="w-2 h-2 rounded-full bg-[#00b83f]" />

                            <span className="text-sm font-medium">
                                Connected
                            </span>

                        </div>

                        <div className="rounded-xl bg-[#f8faf9] border border-[#eeeeee] p-4 mb-5">

                            <div className="text-sm font-medium">
                                Slack notifications are enabled.
                            </div>

                            <div className="text-xs text-gray-400 mt-1">
                                You will receive a Slack alert
                                when the hourly email limit
                                is reached.
                            </div>

                        </div>

                        <button
                            type="button"
                            onClick={handleDisconnect}
                            className="px-5 py-2.5 rounded-lg border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition"
                        >
                            Disconnect Slack
                        </button>

                    </div>

                )}

            </div>

        </div>
    );
}
