import { Link } from "react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { logo } from "../assets";
import Button from "./button";
import Menu from "./menu";
import { getAccessToken } from "../../../../lib/api.js";

export default function Navbar() {
	const [visible, setVisible] = useState(true);
	const [isLoggedIn, setIsLoggedIn] = useState(false);

	useEffect(() => {
		setIsLoggedIn(Boolean(getAccessToken()));
	}, []);

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
			className="fixed top-0 left-0 z-[100] w-full px-6 sm:px-10 py-5 backdrop-blur-sm"
		>
			<div className="relative flex items-center justify-between">
				<Link to="/" className="flex items-center gap-3 cursor-pointer group">
					<img
						src={logo}
						alt="Katitor Logo"
						width={46}
						height={46}
						className="object-contain max-h-[46px] transition-transform duration-300 group-hover:scale-105"
					/>

					<div className="flex flex-col">
						<span className="font-helveticaNeue text-xl font-bold uppercase tracking-wider text-white leading-none">
							Katitor
						</span>
						<span className="font-helveticaNeue text-[10px] uppercase tracking-tight text-white/70">
							Your AI Video Copilot
						</span>
					</div>
				</Link>

				<div className="absolute left-1/2 -translate-x-1/2">
					<Menu />
				</div>

				<div className="ml-auto flex items-center gap-2">
					{isLoggedIn ? (
						<Button
							title="Dashboard"
							to="/dashboard"
						/>
					) : (
						<Button
							title="Get Started"
							to="/register"
						/>
					)}
				</div>
			</div>
		</motion.nav>
	);
}

