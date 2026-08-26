export default function Login() {
  const handleGoogleLogin = () => {
    window.location.href =
      "http://localhost:5000/api/auth/google";
  };

  const handleLogin = (event) => {
    event.preventDefault();
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-[315px] border border-gray-200 rounded-lg bg-white px-9 py-8 shadow-sm">
        <h1 className="text-center text-[26px] font-semibold text-gray-900 mb-7">
          Login
        </h1>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full h-10 rounded-md border border-gray-200 bg-[#e8f7ee] text-gray-800 text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#def3e7] transition"
        >
          <span className="font-bold text-[#4285F4] text-base">
            G
          </span>
          <span>Login with Google</span>
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />

          <span className="text-[10px] text-gray-400 whitespace-nowrap">
            or sign up through email
          </span>

          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-3"
        >
          <input
            type="email"
            placeholder="Email ID"
            className="w-full h-10 rounded-md bg-[#f4f7f5] px-3 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-green-200"
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full h-10 rounded-md bg-[#f4f7f5] px-3 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-green-200"
          />

          <button
            type="submit"
            className="w-full h-10 mt-2 rounded-md bg-[#00b83f] text-white text-sm font-medium hover:bg-[#00a83f] transition"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}