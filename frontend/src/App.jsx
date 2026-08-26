import {
    BrowserRouter,
    Routes,
    Route,
} from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import EmailDetails from "./pages/EmailDetails";
import ComposeEmail from "./pages/ComposeEmail";

function App() {
    return (
        <BrowserRouter>
            <Routes>

                <Route
                    path="/"
                    element={<Login />}
                />

                <Route
                    path="/dashboard"
                    element={<Dashboard />}
                />

                <Route
                    path="/email/:id"
                    element={<EmailDetails />}
                />

                <Route
                    path="/compose"
                    element={<ComposeEmail />}
                />

            </Routes>
        </BrowserRouter>
    );
}

export default App;