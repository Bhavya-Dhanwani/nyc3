"use client";

import { useState, useRef, useEffect } from "react";
import { menuDrop } from "../assets";
import { motion } from "framer-motion";
import { FaGithub } from "react-icons/fa";

const developers = [
	{
		name: "Bhavya Dhanwani",
		url: "https://github.com/bhavya-dhanwani",
	},
	{
		name: "Gaurav Chhajer",
		url: "https://github.com/iamgauravchhajer",
	},
];

export default function Menu() {
	const [hidden, setHidden] = useState(true);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const [menuHeight, setMenuHeight] = useState(360);

	useEffect(() => {
		if (menuRef.current) {
			setMenuHeight(menuRef.current.offsetHeight);
		}
	}, []);

	return (
		<motion.div
			initial={{ y: -(menuHeight + 130) }}
			animate={hidden ? { y: -(menuHeight + 130) } : { y: -30 }}
			transition={{
				duration: 0.8,
				ease: "backInOut",
				type: "tween",
			}}
			className="absolute left-1/2 -translate-x-1/2 z-[999]"
		>
			<div
				ref={menuRef}
				className="w-[420px] rounded-[50px] bg-greenColor p-8 "
			>
				<h2 className="mb-6 text-center font-humaneMedium text-5xl uppercase text-black">
					Developers
				</h2>

				<div className="flex flex-col gap-4">
					{developers.map((dev) => (
						<a
							key={dev.name}
							href={dev.url}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center justify-between rounded-2xl border border-black/15 bg-white/20 px-5 py-4 transition-all duration-300 hover:bg-white/30"
						>
							<div className="flex items-center gap-4">
								<span className="text-black">
									<FaGithub size={28} />
								</span>

								<span className="font-helveticaNeue text-lg uppercase text-black">
									{dev.name}
								</span>
							</div>

							<span className="font-helveticaNeue text-sm uppercase text-black/70">
								View Profile
							</span>
						</a>
					))}
				</div>
			</div>

			<div
				onClick={() => setHidden(!hidden)}
				className="relative cursor-pointer"
			>
				<img
					src={menuDrop}
					alt="menuDrop"
					width={180}
					height={180}
					className="w-full h-full object-cover"
				/>

				<div className="absolute bottom-5 left-1/2 -translate-x-1/2">
					<button
						type="button"
						className="cursor-pointer"
					>
						<div
							className={`w-[28px] h-[2px] bg-black/50 transition-all duration-200 ${
								!hidden ? "translate-y-[1px] rotate-45" : "mb-1"
							}`}
						/>
						<div
							className={`w-[28px] h-[2px] bg-black/50 transition-all duration-200 ${
								!hidden ? "hidden" : "mb-1"
							}`}
						/>
						<div
							className={`w-[28px] h-[2px] bg-black/50 transition-all duration-200 ${
								!hidden ? "-rotate-45" : ""
							}`}
						/>
					</button>
				</div>
			</div>
		</motion.div>
	);
}
