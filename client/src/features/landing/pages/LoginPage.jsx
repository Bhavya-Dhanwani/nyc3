import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ArrowLeft, AlertCircle, ArrowRight, UserPlus, LogIn } from "lucide-react";
import { logo } from "../duevora/assets";
import { setAccessToken } from "../../../lib/api.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: login or signup
  const isRegister = location.pathname === "/register" || location.pathname === "/signup";
  const [error, setError] = useState(null);

  // Check URL params for OAuth callback or errors
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setAccessToken(token);
      window.history.replaceState({}, document.title, window.location.pathname);
      navigate("/dashboard");
    }
    if (params.get("googleError")) {
      setError("Google authentication was canceled or encountered an issue.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [navigate]);

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  // Cursor tracking for 3D sphere avatar
  const avatarWrapperRef = useRef(null);
  const sphereRef = useRef(null);
  const faceRef = useRef(null);

  useEffect(() => {
    const wrapper = avatarWrapperRef.current;
    const sphere = sphereRef.current;
    const face = faceRef.current;
    if (!wrapper || !sphere || !face) return;

    const handleMouseMove = (e) => {
      const rect = wrapper.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const relX = e.clientX - centerX;
      const relY = e.clientY - centerY;

      const maxDisp = 25;
      const faceMaxDisp = 40;

      const dispX = (relX / (window.innerWidth / 2)) * maxDisp;
      const dispY = (relY / window.innerHeight) * maxDisp;
      const faceDispX = (relX / (window.innerWidth / 2)) * faceMaxDisp;
      const faceDispY = (relY / window.innerHeight) * faceMaxDisp;

      gsap.to(sphere, {
        x: dispX,
        y: dispY,
        ease: "power2.out",
        duration: 0.35,
      });

      gsap.to(face, {
        x: faceDispX,
        y: faceDispY,
        ease: "power2.out",
        duration: 0.35,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative w-full h-screen bg-[#07080d] overflow-hidden flex flex-col font-helveticaNeue text-white select-none">
      {/* Floating Top Navbar */}
      <header className="fixed top-0 left-0 z-50 w-full px-6 sm:px-12 py-5 flex items-center justify-between pointer-events-auto">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src={logo}
            alt="Duevora Logo"
            width={46}
            height={46}
            className="brightness-125 transition-transform duration-300 group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="font-humaneMedium text-3xl sm:text-4xl leading-none tracking-tight text-white">
              DUEVORA
            </span>
            <span className="text-[10px] uppercase tracking-widest text-white/70">
              AI Video & Business Copilot
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Direct Switcher to Sign In or Sign Up */}
          {isRegister ? (
            <Link
              to="/login"
              className="px-4 sm:px-5 py-2 rounded-full border border-white/60 hover:border-white bg-white/10 hover:bg-white hover:text-black text-xs uppercase tracking-wider text-white transition-all duration-200 flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <LogIn size={13} />
              <span>Sign In</span>
            </Link>
          ) : (
            <Link
              to="/register"
              className="px-4 sm:px-5 py-2 rounded-full bg-white text-black hover:bg-neutral-100 text-xs uppercase tracking-wider font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <UserPlus size={13} />
              <span>Sign Up</span>
            </Link>
          )}

          <Link
            to="/"
            className="px-4 sm:px-5 py-2 border-[2px] border-white/40 hover:border-white text-white hover:bg-white/10 rounded-full text-xs uppercase font-medium font-helveticaNeue tracking-tight transition-all duration-300 flex items-center gap-2 cursor-pointer backdrop-blur-md"
          >
            <ArrowLeft size={14} />
            <span className="hidden xs:inline">Home</span>
          </Link>
        </div>
      </header>

      {/* 2-Part Split Layout Container */}
      <main
        className={`flex-1 w-full h-full flex flex-col ${
          isRegister ? "lg:flex-row-reverse" : "lg:flex-row"
        } transition-all duration-500 overflow-hidden`}
      >
        {/* ======================================================== */}
        {/* PART 1: Crazy Vibrant Duevora UI Side                   */}
        {/* ======================================================== */}
        <div className="w-full lg:w-1/2 h-full bg-heroColor relative flex flex-col items-center justify-center p-6 sm:p-12 overflow-hidden z-10">
          {/* Hand-drawn Background Doodles */}
          <div className="absolute -top-16 -right-16 pointer-events-none select-none opacity-25">
            <img
              src="/duevora/linedraw.svg"
              alt=""
              width={280}
              height={280}
              className="rotate-[110deg]"
            />
          </div>
          <div className="absolute -bottom-16 -left-16 pointer-events-none select-none opacity-25">
            <img
              src="/duevora/linedraw.svg"
              alt=""
              width={280}
              height={280}
            />
          </div>

          <div className="w-full flex flex-col items-center text-center relative z-10 max-w-xl mx-auto">
            {/* Colossal DUEVORA Title */}
            <div className="w-full text-center">
              <h1 className="font-humaneMedium text-[26vw] lg:text-[15vw] uppercase leading-[0.78] tracking-[-3px] sm:tracking-[-6px] text-white drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)] select-none">
                DUEVORA
              </h1>
            </div>

            {/* Interactive 3D Eye Avatar (Centered) */}
            <div
              ref={avatarWrapperRef}
              className="relative w-[160px] h-[160px] sm:w-[190px] sm:h-[190px] my-3 sm:my-5 flex items-center justify-center pointer-events-auto"
            >
              <div
                ref={sphereRef}
                className="w-full h-full bg-[url('/duevora/sphere.png')] bg-cover bg-center rounded-full relative shadow-[0_25px_60px_rgba(0,0,0,0.45)]"
              >
                <div
                  ref={faceRef}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[115px] h-[105px] flex flex-col justify-between"
                >
                  {/* Spinning Star Eyes */}
                  <div className="flex justify-between items-center px-1">
                    <motion.img
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 4, ease: "linear", repeat: Infinity }}
                      src="/duevora/eyes.svg"
                      alt="eye"
                      className="w-[40px] h-[40px]"
                    />
                    <motion.img
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 4, ease: "linear", repeat: Infinity }}
                      src="/duevora/eyes.svg"
                      alt="eye"
                      className="w-[40px] h-[40px]"
                    />
                  </div>

                  {/* Animated Mouth */}
                  <div className="flex justify-center items-center">
                    <motion.div
                      animate={{ height: [18, 34, 18] }}
                      transition={{
                        duration: 2,
                        ease: [0.075, 0.82, 0.165, 1],
                        repeat: Infinity,
                        repeatType: "reverse",
                      }}
                      className="w-5 h-5 rounded-full bg-black"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 px-5 py-2.5 bg-black/85 border border-red-400/50 rounded-full text-red-300 text-xs flex items-center gap-2 shadow-2xl backdrop-blur-md"
              >
                <AlertCircle size={15} className="text-red-400 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* HIGH-CONTRAST GOOGLE LOGIN BUTTON (SINGLE LINE) */}
            <div className="w-full max-w-md sm:max-w-lg px-2 mt-2">
              <motion.button
                type="button"
                onClick={handleGoogleLogin}
                whileHover={{ scale: 1.025, y: -2 }}
                whileTap={{ scale: 0.975 }}
                className="w-full py-4 sm:py-4.5 px-5 sm:px-7 bg-white hover:bg-neutral-50 text-black border-2 border-white rounded-full flex items-center justify-between gap-3 sm:gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)] transition-all cursor-pointer group"
              >
                {/* Google 4-Color Icon */}
                <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center shrink-0">
                  <svg width="100%" height="100%" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>

                {/* Single-line Guaranteed Text */}
                <span className="font-helveticaNeue font-bold text-[11.5px] xs:text-xs sm:text-sm md:text-sm uppercase tracking-[0.08em] sm:tracking-[0.11em] text-black whitespace-nowrap text-center flex-1 select-none">
                  {isRegister ? "Sign Up with Google & Drive" : "Continue with Google & Drive"}
                </span>

                {/* Arrow Button */}
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black text-white flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:translate-x-1 shadow-md">
                  <ArrowRight size={15} />
                </div>
              </motion.button>
            </div>

            {/* Switcher Link Underneath Button */}
            <div className="mt-5 text-xs text-white/80 flex items-center gap-1.5">
              {isRegister ? (
                <>
                  <span>Already have an account?</span>
                  <Link
                    to="/login"
                    className="font-bold text-white underline hover:text-[#b3eb16] transition-colors"
                  >
                    Log In
                  </Link>
                </>
              ) : (
                <>
                  <span>Don't have an account?</span>
                  <Link
                    to="/register"
                    className="font-bold text-white underline hover:text-[#b3eb16] transition-colors"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PART 2: Full-Bleed Looping Video Showcase (Desktop Only) */}
        {/* ======================================================== */}
        <div className="hidden lg:flex w-full lg:w-1/2 h-full relative overflow-hidden bg-black items-center justify-center">
          {/* Full-Bleed Video covering the whole side */}
          <video
            src="/duevora/Duevora.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover absolute inset-0 select-none pointer-events-none"
          />

          {/* Cinematic Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 pointer-events-none" />

          {/* Floating Live Badge & Feature Tags */}
          <div className="absolute top-24 left-10 z-20 flex items-center gap-2 px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/20 text-xs font-bold uppercase tracking-wider text-white shadow-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Duevora Video Intelligence</span>
          </div>

          {/* Bottom Overlay Title & Subtitle */}
          <div className="absolute bottom-12 left-10 right-10 z-20 flex flex-col gap-2.5 pointer-events-none">
            <span className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[#b3eb16] drop-shadow-md">
              AI Video & Short-Form Automation
            </span>
            <h2 className="text-2xl xl:text-3xl font-helveticaNeue font-bold leading-snug tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
              Turn long footage into viral Shorts in minutes.
            </h2>
            <p className="text-xs xl:text-sm font-helveticaNeue text-white/80 leading-relaxed max-w-md drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] font-normal">
              Automated smart framing, speech transcription, and multi-track timeline editing synced to Google Drive.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
