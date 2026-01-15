import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Room from "./pages/Room";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:id" element={<Room />} />
      </Routes>
    </BrowserRouter>
  );
}
