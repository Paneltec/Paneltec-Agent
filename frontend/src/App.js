import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TopBar from "./components/TopBar";
import Home from "./pages/Home";
import SearchResults from "./pages/SearchResults";
import Library from "./pages/Library";
import Dashboard from "./pages/Dashboard";
import FileViewer from "./pages/FileViewer";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <TopBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/library" element={<Library />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/file/:id" element={<FileViewer />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
