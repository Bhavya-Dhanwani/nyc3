import { useEffect } from "react";
import DuevoraLanding from "../duevora/DuevoraLanding";

export default function LandingPage() {
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
