import MainLayout from "../layouts/MainLayout";
import LandingPage from "../../features/landing/pages/LandingPage";

// Dashboard is the current App component
import { App as DashboardPage } from "../../App";

export const routes = [
  {
    element: <MainLayout />,
    children: [
      {
        path: "/",
        element: <DashboardPage />,
      },
      {
        path: "/landing",
        element: <LandingPage />,
      },
    ],
  },

  // 404
  {
    path: "*",
    element: <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>404</h1>
      <p>Page not found</p>
      <a href="/">Go to Dashboard</a>
    </div>,
  },
];
