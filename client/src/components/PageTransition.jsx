import React, { useEffect, useRef } from "react";
import { useLocation, useOutlet } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { logo } from "../features/landing/duevora/assets";

const TARGET_ROUTES = ["/", "/login", "/register", "/signup"];

export default function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const prevPathRef = useRef(location.pathname);

  const isTargetRoute = TARGET_ROUTES.includes(location.pathname);
  const wasTargetRoute = TARGET_ROUTES.includes(prevPathRef.current);
  const shouldAnimateOverlay = isTargetRoute || wasTargetRoute;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden">
      {/* Top glowing laser line on route change */}
      {shouldAnimateOverlay && (
        <motion.div
          key={`laser-${location.pathname}`}
          initial={{ scaleX: 0, opacity: 0.9, transformOrigin: "0% 50%" }}
          animate={{
            scaleX: [0, 0.7, 1],
            opacity: [0.9, 1, 0],
          }}
          transition={{
            duration: 0.65,
            times: [0, 0.6, 1],
            ease: [0.22, 1, 0.36, 1],
          }}
          className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#5546ff] via-[#8338ec] to-[#a855f7] z-[99999] shadow-[0_0_15px_rgba(85,70,255,0.9),0_0_30px_rgba(131,56,236,0.6)] pointer-events-none"
        />
      )}

      {/* Cinematic Duevora Curtain Overlay for Target Routes */}
      <AnimatePresence mode="wait">
        {shouldAnimateOverlay && (
          <motion.div
            key={`curtain-${location.pathname}`}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 1 }}
            transition={{
              duration: 0.45,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center bg-[#07080d]/80 backdrop-blur-md"
          >
            {/* Center glowing brand emblem */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{
                scale: [0.85, 1.05, 1],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 0.42,
                times: [0, 0.5, 1],
                ease: "easeOut",
              }}
              className="flex flex-col items-center gap-3"
            >
              <div className="relative flex items-center justify-center">
                <div className="absolute w-20 h-20 rounded-full bg-[#5546ff]/30 blur-xl animate-pulse" />
                <img
                  src={logo}
                  alt="Katitor Logo"
                  className="w-12 h-12 relative z-10 object-contain brightness-125 drop-shadow-[0_0_20px_rgba(85,70,255,0.7)]"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Content Transition Container */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={
            shouldAnimateOverlay
              ? { opacity: 0, y: 18, filter: "blur(6px)", scale: 0.99 }
              : { opacity: 0 }
          }
          animate={{
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            scale: 1,
          }}
          exit={
            shouldAnimateOverlay
              ? { opacity: 0, y: -14, filter: "blur(6px)", scale: 0.99 }
              : { opacity: 0 }
          }
          transition={{
            duration: 0.38,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="w-full min-h-screen"
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
