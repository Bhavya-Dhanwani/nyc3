import MainLayout from "../layouts/MainLayout";
import LandingPage from "../../features/landing/pages/LandingPage";
import LoginPage from "../../features/landing/pages/LoginPage";
import { App as DashboardPage } from "../../App";

export const routes = [
  {
    element: <MainLayout />,
    children: [
      {
        path: "/",
        element: <LandingPage />,
      },
      {
        path: "/login",
        element: <LoginPage initialMode="login" />,
      },
      {
        path: "/register",
        element: <LoginPage initialMode="signup" />,
      },
      {
        path: "/signup",
        element: <LoginPage initialMode="signup" />,
      },
      {
        path: "/dashboard",
        element: <DashboardPage />,
      },
      {
        path: "/editor",
        element: <DashboardPage />,
      },
      {
        path: "/editor/:projectId",
        element: <DashboardPage />,
      },
    ],
  },

  // 404
  {
    path: "*",
    element: <div style={{ padding: "2rem", textAlign: "center", color: "#fff", background: "#07080d", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "4rem", margin: 0 }}>404</h1>
      <p style={{ color: "rgba(255,255,255,0.6)" }}>Page not found</p>
      <a href="/dashboard" style={{ color: "#5546ff", textDecoration: "underline" }}>Go to Dashboard</a>
    </div>,
  },
];
