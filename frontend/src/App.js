import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TopBar from "./components/TopBar";
import Home from "./pages/Home";
import SearchResults from "./pages/SearchResults";
import Library from "./pages/Library";
import Dashboard from "./pages/Dashboard";
import FileViewer from "./pages/FileViewer";
import Admin from "./pages/Admin";
import Embed from "./pages/Embed";
import { useLocation } from "react-router-dom";

function Chrome() {
  const loc = useLocation();
  if (loc.pathname.startsWith("/embed")) return null;
  return <TopBar />;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Chrome />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/library" element={<Library />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/embed" element={<Embed />} />
          <Route path="/file/:id" element={<FileViewer />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
