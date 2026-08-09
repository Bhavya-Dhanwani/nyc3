"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { logo } from "../assets";
import Button from "./button";
import Menu from "./menu";

export default function Navbar() {
	const [visible, setVisible] = useState(true);

	useEffect(() => {
		let lastScrollY = window.scrollY;

		const handleScroll = () => {
			const currentScrollY = window.scrollY;

			// Always show near the top
			if (currentScrollY < 50) {
				setVisible(true);
			} else {
				setVisible(currentScrollY < lastScrollY);
			}

			lastScrollY = currentScrollY;
		};

		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	return (
		<motion.nav
			initial={{ y: 0 }}
			animate={{ y: visible ? 0 : -120 }}
			transition={{
				duration: 0.4,
				ease: [0.25, 1, 0.5, 1],
			}}
			className="fixed top-0 left-0 z-[100] w-full px-6 sm:px-10 py-5 backdrop-blur-md bg-black/10"
		>
			<div className="relative flex items-center justify-between">
				<Link to="/" className="flex flex-col gap-1">
					<img
						src={logo}
						alt="Duevora Logo"
						width={48}
						height={48}
						className="brightness-125"
					/>

					<p className="font-helveticaNeue text-xs sm:text-sm uppercase tracking-tight text-white hidden xs:block">
						Your AI Business Copilot
					</p>
				</Link>

				<div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
					<Menu />
				</div>

				<div className="ml-auto flex items-center gap-3 sm:gap-4">
					<Button
						title="Sign In"
						to="/login"
						variant="outline"
					/>
					<Button
						title="Sign Up"
						to="/register"
						variant="solid"
					/>
				</div>
			</div>
		</motion.nav>
	);
}
