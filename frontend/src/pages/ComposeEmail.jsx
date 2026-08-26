import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:5000";

export default function ComposeEmail() {
    const navigate = useNavigate();

    const editorRef = useRef(null);
    const fileInputRef = useRef(null);
    const csvInputRef = useRef(null);

    const [user, setUser] = useState(null);

    const [recipients, setRecipients] = useState([]);
    const [recipientInput, setRecipientInput] = useState("");

    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");

    const [delay, setDelay] = useState("02");
    const [hourlyLimit, setHourlyLimit] = useState("15");

    const [attachments, setAttachments] = useState([]);

    const [showSendLater, setShowSendLater] = useState(false);
    const [scheduledAt, setScheduledAt] = useState("");

    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const [error, setError] = useState("");

    const [csvFileName, setCsvFileName] = useState("");
    const [csvCount, setCsvCount] = useState(0);

    // ==========================================
    // LOAD USER
    // ==========================================

    useEffect(() => {
        const loadUser = async () => {
            try {
                const response = await fetch(
                    `${API}/api/auth/me`,
                    {
                        credentials: "include",
                    }
                );

                if (response.status === 401) {
                    navigate("/");
                    return;
                }

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                            "Failed to load user"
                    );
                }

                setUser(data.user);
            } catch (error) {
                console.error(error);

                setError(
                    "Unable to load user."
                );
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, [navigate]);

    // ==========================================
    // EMAIL VALIDATION
    // ==========================================

    const isValidEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            email
        );
    };

    // ==========================================
    // ADD RECIPIENT
    // ==========================================

    const addRecipient = (value) => {
        const email = value.trim();

        if (!email) {
            return;
        }

        if (!isValidEmail(email)) {
            setError(
                `Invalid email: ${email}`
            );
            return;
        }

        if (recipients.includes(email)) {
            setRecipientInput("");
            return;
        }

        setRecipients((previous) => [
            ...previous,
            email,
        ]);

        setRecipientInput("");
        setError("");
    };

    // ==========================================
    // REMOVE RECIPIENT
    // ==========================================

    const removeRecipient = (email) => {
        setRecipients((previous) =>
            previous.filter(
                (item) => item !== email
            )
        );
    };

    // ==========================================
    // RECIPIENT KEYBOARD
    // ==========================================

    const handleRecipientKeyDown = (event) => {
        if (
            event.key === "Enter" ||
            event.key === "," ||
            event.key === " "
        ) {
            event.preventDefault();

            addRecipient(
                recipientInput
            );
        }

        if (
            event.key === "Backspace" &&
            !recipientInput &&
            recipients.length > 0
        ) {
            removeRecipient(
                recipients[
                    recipients.length - 1
                ]
            );
        }
    };

    // ==========================================
    // CSV UPLOAD
    // ==========================================

    const handleCsvUpload = async (event) => {
        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        try {
            setError("");
            setCsvFileName(file.name);

            const text =
                await file.text();

            /*
             * Extract all email addresses
             * from CSV / TXT.
             *
             * This works even if CSV contains:
             *
             * name,email
             * Rahul,rahul@gmail.com
             * Amit,amit@gmail.com
             */

            const matches =
                text.match(
                    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
                ) || [];

            const uniqueEmails = [
                ...new Set(
                    matches.map((email) =>
                        email
                            .trim()
                            .toLowerCase()
                    )
                ),
            ];

            if (
                uniqueEmails.length === 0
            ) {
                setCsvCount(0);

                setError(
                    "No valid email addresses found in this file."
                );

                return;
            }

            /*
             * Add CSV emails to existing
             * manually entered recipients.
             *
             * Duplicate emails are removed.
             */

            setRecipients(
                (previous) => [
                    ...new Set([
                        ...previous,
                        ...uniqueEmails,
                    ]),
                ]
            );

            setCsvCount(
                uniqueEmails.length
            );

            console.log(
                "CSV emails:",
                uniqueEmails
            );
        } catch (error) {
            console.error(
                "CSV upload error:",
                error
            );

            setError(
                "Failed to read CSV file."
            );
        } finally {
            /*
             * Same file can be uploaded
             * again if required.
             */

            event.target.value = "";
        }
    };

    // ==========================================
    // EDITOR
    // ==========================================

    const handleEditorInput = () => {
        if (!editorRef.current) {
            return;
        }

        setBody(
            editorRef.current.innerHTML
        );
    };

    const exec = (command) => {
        document.execCommand(
            command,
            false,
            null
        );

        editorRef.current?.focus();

        handleEditorInput();
    };

    // ==========================================
    // ATTACHMENTS
    // ==========================================

    const handleFiles = (event) => {
        const files = Array.from(
            event.target.files || []
        );

        if (!files.length) {
            return;
        }

        setAttachments(
            (previous) => [
                ...previous,
                ...files,
            ]
        );

        event.target.value = "";
    };

    const removeAttachment = (
        index
    ) => {
        setAttachments(
            (previous) =>
                previous.filter(
                    (_, i) =>
                        i !== index
                )
        );
    };

    // ==========================================
    // VALIDATION
    // ==========================================

    const validateForm = () => {
        setError("");

        let finalRecipients = [
            ...recipients,
        ];

        if (recipientInput.trim()) {
            finalRecipients.push(
                recipientInput.trim()
            );
        }

        finalRecipients = [
            ...new Set(
                finalRecipients
            ),
        ];

        if (
            finalRecipients.length === 0
        ) {
            setError(
                "Please enter or upload at least one recipient."
            );

            return null;
        }

        for (
            const email of finalRecipients
        ) {
            if (!isValidEmail(email)) {
                setError(
                    `Invalid email: ${email}`
                );

                return null;
            }
        }

        if (!subject.trim()) {
            setError(
                "Please enter a subject."
            );

            return null;
        }

        const textContent =
            editorRef.current
                ?.innerText
                ?.trim() || "";

        if (
            !textContent &&
            !body.trim()
        ) {
            setError(
                "Please enter email message."
            );

            return null;
        }

        return finalRecipients;
    };

    // ==========================================
    // SCHEDULE EMAIL
    // ==========================================

    const scheduleEmail = async (
        finalRecipients,
        date
    ) => {
        try {
            setSending(true);
            setError("");

            const scheduleDate =
                new Date(date);

            if (
                Number.isNaN(
                    scheduleDate.getTime()
                )
            ) {
                setError(
                    "Please select a valid date and time."
                );

                setSending(false);
                return;
            }

            if (
                scheduleDate.getTime() <=
                Date.now()
            ) {
                setError(
                    "Schedule time must be in the future."
                );

                setSending(false);
                return;
            }

            const response =
                await fetch(
                    `${API}/api/emails/schedule`,
                    {
                        method: "POST",

                        credentials:
                            "include",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body: JSON.stringify(
                            {
                                /*
                                 * Multiple emails are
                                 * sent as comma-separated
                                 * string because your
                                 * Prisma Email.to is String.
                                 */

                                to: finalRecipients.join(
                                    ","
                                ),

                                subject:
                                    subject.trim(),

                                body:
                                    body.trim() ||
                                    editorRef.current?.innerText ||
                                    "",

                                scheduledAt:
                                    scheduleDate.toISOString(),
                            }
                        ),
                    }
                );

            if (
                response.status === 401
            ) {
                navigate("/");
                return;
            }

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        "Failed to schedule email."
                );
            }

            navigate(
                "/dashboard"
            );
        } catch (error) {
            console.error(
                "Schedule email error:",
                error
            );

            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to schedule email."
            );
        } finally {
            setSending(false);
        }
    };

    // ==========================================
    // SEND NOW
    // ==========================================

    const handleSend = async () => {
        const finalRecipients =
            validateForm();

        if (!finalRecipients) {
            return;
        }

        const sendTime =
            new Date(
                Date.now() + 3000
            );

        await scheduleEmail(
            finalRecipients,
            sendTime
        );
    };

    // ==========================================
    // SEND LATER
    // ==========================================

    const handleSendLater = () => {
        const finalRecipients =
            validateForm();

        if (!finalRecipients) {
            return;
        }

        setShowSendLater(true);
    };

    // ==========================================
    // DONE
    // ==========================================

    const handleDone = async () => {
        const finalRecipients =
            validateForm();

        if (!finalRecipients) {
            return;
        }

        if (!scheduledAt) {
            setError(
                "Please select a date and time."
            );

            return;
        }

        setShowSendLater(false);

        await scheduleEmail(
            finalRecipients,
            scheduledAt
        );
    };

    // ==========================================
    // QUICK TIME
    // ==========================================

    const setQuickTime = (type) => {
        const now = new Date();

        now.setDate(
            now.getDate() + 1
        );

        if (type === "tomorrow") {
            now.setHours(
                9,
                0,
                0,
                0
            );
        }

        if (type === "10am") {
            now.setHours(
                10,
                0,
                0,
                0
            );
        }

        if (type === "11am") {
            now.setHours(
                11,
                0,
                0,
                0
            );
        }

        if (type === "3pm") {
            now.setHours(
                15,
                0,
                0,
                0
            );
        }

        const local =
            new Date(
                now.getTime() -
                    now.getTimezoneOffset() *
                        60000
            )
                .toISOString()
                .slice(0, 16);

        setScheduledAt(local);
    };

    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-sm text-gray-500">
                    Loading...
                </div>
            </div>
        );
    }

    // ==========================================
    // UI
    // ==========================================

    return (
        <div className="min-h-screen bg-white text-[#202020]">

            {/* HEADER */}

            <div className="h-[58px] border-b border-[#eeeeee] flex items-center px-4">

                <button
                    type="button"
                    onClick={() =>
                        navigate(
                            "/dashboard"
                        )
                    }
                    className="flex items-center gap-2 text-[16px] hover:text-gray-500"
                >
                    <span className="text-xl">
                        ←
                    </span>

                    <span>
                        Compose New Email
                    </span>
                </button>

                <div className="ml-auto flex items-center gap-5">

                    <button
                        type="button"
                        onClick={() =>
                            fileInputRef.current?.click()
                        }
                        className="text-gray-500 hover:text-[#00a83f] text-xl"
                        title="Attach file"
                    >
                        📎
                    </button>

                    <button
                        type="button"
                        onClick={
                            handleSendLater
                        }
                        className="text-gray-500 hover:text-[#00a83f] text-lg"
                        title="Send later"
                    >
                        ◷
                    </button>

                    <button
                        type="button"
                        onClick={
                            handleSend
                        }
                        disabled={sending}
                        className="h-9 px-5 rounded-full border border-[#00b83f] text-[#00a83f] text-sm hover:bg-[#f0fff5] disabled:opacity-50"
                    >
                        {sending
                            ? "Sending..."
                            : "Send"}
                    </button>

                </div>
            </div>

            {/* CONTENT */}

            <div className="max-w-[860px] mx-auto px-6 pt-8">

                {/* FROM */}

                <div className="flex items-center min-h-[45px] border-b border-[#eeeeee]">

                    <div className="w-[65px] text-xs text-gray-500">
                        From
                    </div>

                    <div className="bg-[#f4f6f5] rounded-lg px-3 py-2 text-sm">
                        {"treva.gleason52@ethereal.email"}

                        <span className="ml-2 text-gray-400">
                            ⌄
                        </span>
                    </div>

                </div>

                {/* TO */}

                <div className="flex items-start min-h-[52px] border-b border-[#eeeeee]">

                    <div className="w-[65px] text-xs text-gray-500 shrink-0 pt-4">
                        To
                    </div>

                    <div className="flex-1">

                        <div className="flex items-center flex-wrap gap-1.5 py-2">

                            {recipients.map(
                                (email) => (
                                    <span
                                        key={email}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#00b83f] bg-[#f3fff7] text-[11px] text-[#008c36]"
                                    >
                                        {email}

                                        <button
                                            type="button"
                                            onClick={() =>
                                                removeRecipient(
                                                    email
                                                )
                                            }
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            ×
                                        </button>
                                    </span>
                                )
                            )}

                            <input
                                type="text"
                                value={
                                    recipientInput
                                }
                                onChange={(event) =>
                                    setRecipientInput(
                                        event.target.value
                                    )
                                }
                                onKeyDown={
                                    handleRecipientKeyDown
                                }
                                onBlur={() => {
                                    if (
                                        recipientInput.trim()
                                    ) {
                                        addRecipient(
                                            recipientInput
                                        );
                                    }
                                }}
                                placeholder={
                                    recipients.length ===
                                    0
                                        ? "recipient@example.com"
                                        : ""
                                }
                                className="flex-1 min-w-[180px] h-8 outline-none text-sm"
                            />

                            {/* CSV BUTTON */}

                            <button
                                type="button"
                                onClick={() =>
                                    csvInputRef.current?.click()
                                }
                                className="text-xs text-[#00a83f] hover:underline whitespace-nowrap"
                            >
                                ↑ Upload List
                            </button>

                        </div>

                        {/* CSV INFO */}

                        {csvFileName && (
                            <div className="pb-2 flex items-center gap-2 text-xs">

                                <span className="text-gray-500">
                                    📄 {csvFileName}
                                </span>

                                <span className="text-[#00a83f] font-medium">
                                    {csvCount} emails detected
                                </span>

                            </div>
                        )}

                    </div>

                </div>

                {/* HIDDEN CSV INPUT */}

                <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={
                        handleCsvUpload
                    }
                    className="hidden"
                />

                {/* SUBJECT */}

                <div className="flex items-center h-[48px] border-b border-[#eeeeee]">

                    <div className="w-[65px] text-xs text-gray-500">
                        Subject
                    </div>

                    <input
                        type="text"
                        value={subject}
                        onChange={(event) =>
                            setSubject(
                                event.target.value
                            )
                        }
                        placeholder="Subject"
                        className="flex-1 outline-none text-sm"
                    />

                </div>

                {/* DELAY / LIMIT */}

                <div className="flex items-center gap-5 h-[48px] border-b border-[#eeeeee]">

                    <div className="flex items-center gap-2 text-xs">

                        <span>
                            Delay between 2 emails
                        </span>

                        <input
                            value={delay}
                            onChange={(event) =>
                                setDelay(
                                    event.target.value
                                )
                            }
                            className="w-[42px] h-7 border border-gray-200 rounded-md text-center outline-none text-xs"
                        />

                    </div>

                    <div className="flex items-center gap-2 text-xs">

                        <span>
                            Hourly Limit
                        </span>

                        <input
                            value={
                                hourlyLimit
                            }
                            onChange={(event) =>
                                setHourlyLimit(
                                    event.target.value
                                )
                            }
                            className="w-[42px] h-7 border border-gray-200 rounded-md text-center outline-none text-xs"
                        />

                    </div>

                </div>

                {/* EDITOR */}

                <div className="mt-3">

                    <div className="bg-[#fafafa] rounded-lg min-h-[290px]">

                        <div
                            ref={editorRef}
                            contentEditable
                            suppressContentEditableWarning
                            onInput={
                                handleEditorInput
                            }
                            data-placeholder="Type Your Reply..."
                            className="min-h-[55px] px-4 pt-3 text-sm outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                        />

                        <div className="mx-3 mb-3 h-[34px] bg-white rounded-full flex items-center px-3 gap-4 text-gray-500">

                            <button
                                type="button"
                                onClick={() =>
                                    exec("undo")
                                }
                            >
                                ↶
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    exec("redo")
                                }
                            >
                                ↷
                            </button>

                            <span className="text-gray-200">
                                |
                            </span>

                            <button
                                type="button"
                                onClick={() =>
                                    exec("bold")
                                }
                                className="font-bold"
                            >
                                B
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    exec("italic")
                                }
                                className="italic"
                            >
                                I
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    exec("underline")
                                }
                                className="underline"
                            >
                                U
                            </button>

                            <span className="text-gray-200">
                                |
                            </span>

                            <button
                                type="button"
                                onClick={() =>
                                    exec(
                                        "justifyLeft"
                                    )
                                }
                            >
                                ≡
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    exec(
                                        "insertOrderedList"
                                    )
                                }
                            >
                                1.
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    exec(
                                        "insertUnorderedList"
                                    )
                                }
                            >
                                •
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    exec(
                                        "strikeThrough"
                                    )
                                }
                            >
                                S
                            </button>

                        </div>

                    </div>

                </div>

                {/* ATTACHMENTS */}

                {attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">

                        {attachments.map(
                            (
                                file,
                                index
                            ) => (
                                <div
                                    key={`${file.name}-${index}`}
                                    className="relative border border-gray-200 rounded-lg overflow-hidden bg-white"
                                >

                                    {file.type.startsWith(
                                        "image/"
                                    ) ? (
                                        <img
                                            src={URL.createObjectURL(
                                                file
                                            )}
                                            alt={
                                                file.name
                                            }
                                            className="w-[130px] h-[90px] object-cover"
                                        />
                                    ) : (
                                        <div className="w-[130px] h-[90px] flex items-center justify-center text-xs text-gray-500 px-2 text-center">
                                            📄
                                            <br />
                                            {
                                                file.name
                                            }
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            removeAttachment(
                                                index
                                            )
                                        }
                                        className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full shadow text-gray-500 hover:text-red-500"
                                    >
                                        ×
                                    </button>

                                    <div className="px-2 py-1 text-[10px] truncate max-w-[130px]">
                                        {
                                            file.name
                                        }
                                    </div>

                                </div>
                            )
                        )}

                    </div>
                )}

                {/* ATTACHMENT INPUT */}

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={
                        handleFiles
                    }
                    className="hidden"
                />

                {/* ERROR */}

                {error && (
                    <div className="mt-4 bg-red-50 border border-red-100 text-red-600 rounded-lg px-4 py-3 text-sm">
                        {error}
                    </div>
                )}

            </div>

            {/* SEND LATER */}

            {showSendLater && (
                <div className="fixed inset-0 z-50 pointer-events-none">

                    <div className="absolute top-[56px] right-4 w-[320px] bg-white rounded-lg border border-gray-200 shadow-xl pointer-events-auto">

                        <div className="px-3 py-4 text-sm font-medium border-b border-gray-100">
                            Send Later
                        </div>

                        <div className="px-3 pt-3">

                            <label className="text-[11px] text-gray-400">
                                Pick date & time
                            </label>

                            <input
                                type="datetime-local"
                                value={
                                    scheduledAt
                                }
                                onChange={(event) =>
                                    setScheduledAt(
                                        event.target.value
                                    )
                                }
                                className="mt-1 w-full h-9 border border-gray-200 rounded-md px-2 text-xs outline-none focus:border-[#00b83f]"
                            />

                        </div>

                        <div className="py-2">

                            <button
                                type="button"
                                onClick={() =>
                                    setQuickTime(
                                        "tomorrow"
                                    )
                                }
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                            >
                                Tomorrow
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setQuickTime(
                                        "10am"
                                    )
                                }
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                            >
                                Tomorrow, 10:00 AM
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setQuickTime(
                                        "11am"
                                    )
                                }
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                            >
                                Tomorrow, 11:00 AM
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setQuickTime(
                                        "3pm"
                                    )
                                }
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                            >
                                Tomorrow, 3:00 PM
                            </button>

                        </div>

                        <div className="px-3 py-3 border-t border-gray-100 flex justify-end gap-3">

                            <button
                                type="button"
                                onClick={() =>
                                    setShowSendLater(
                                        false
                                    )
                                }
                                disabled={sending}
                                className="text-xs text-gray-600 px-4 py-2"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={
                                    handleDone
                                }
                                disabled={sending}
                                className="text-xs text-[#00a83f] border border-[#00b83f] rounded-full px-5 py-2 hover:bg-[#f0fff5]"
                            >
                                {sending
                                    ? "Saving..."
                                    : "Done"}
                            </button>

                        </div>

                    </div>

                </div>
            )}

        </div>
    );
}

