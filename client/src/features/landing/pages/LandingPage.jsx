import { useEffect } from "react";
import { useNavigate } from "react-router";
import DuevoraLanding from "../duevora/DuevoraLanding";
import { setAccessToken } from "../../../lib/api.js";

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setAccessToken(token);
      window.history.replaceState({}, document.title, "/dashboard");
      navigate("/dashboard");
    }
  }, [navigate]);

  useEffect(() => {
    document.documentElement.classList.add("hide-scrollbar");
    document.body.classList.add("hide-scrollbar");
    return () => {
      document.documentElement.classList.remove("hide-scrollbar");
      document.body.classList.remove("hide-scrollbar");
    };
  }, []);

  return <DuevoraLanding />;
}
