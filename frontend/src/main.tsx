import React from 'react'
import ReactDOM from 'react-dom/client'
import { Route, Routes, HashRouter } from "react-router-dom";
import App from "@layouts/App"
import Home from "@pages/Home"
import KeyboardShortcuts from '@pages/KeyboardShortcuts';
import Settings from '@pages/Settings';
import Selection from '@pages/Selection';
import Overlay from "@pages/Overlay"
import "@assets/app.css"
import "./i18n"


ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HashRouter basename="/">
      <Routes>
        <Route element={<App />}>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/selection" element={<Selection />} />
          <Route path="/settings/shortcuts" element={<KeyboardShortcuts />} />
        </Route>
        <Route path="/overlay" element={<Overlay />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
)
