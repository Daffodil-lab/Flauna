import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Lobby from "./routes/Lobby";

// Room pulls in Konva via the map components, which adds ~290 KB raw to the
// critical path. Lazy-loading it keeps the Lobby paint (and Lighthouse FCP
// against `/`) off the Konva chunk.
const Room = lazy(() => import("./routes/Room"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Lobby />} />
      <Route
        path="/room/:roomId"
        element={
          <Suspense fallback={null}>
            <Room />
          </Suspense>
        }
      />
    </Routes>
  );
}
