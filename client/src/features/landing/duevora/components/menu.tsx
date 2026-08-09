"use client";

import { useState } from "react";
import { menuDrop } from "../assets";
import { motion } from "framer-motion";
import { FaGithub } from "react-icons/fa";

const developers = [
	{
		name: "Harshit Raghuwanshi",
		url: "https://github.com/harshit403-pixel",
	},
	{
		name: "Bhavya Dhanwani",
		url: "https://github.com/bhavya-dhanwani",
	},
	{
		name: "Rohit Pokhariya",
		url: "https://github.com/rohitpokhariya10",
	},
];

export default function Menu() {
	const [hidden, setHidden] = useState(true);

	return (
		<motion.div
			initial={{ y: -490 }}
			animate={hidden ? { y: -490 } : { y: -30 }}
			transition={{
				duration: 0.8,
				ease: "backInOut",
				type: "tween",
			}}
			className="absolute left-1/2 -translate-x-1/2 z-[999]"
		>
			<div className="w-[420px] rounded-[50px] bg-greenColor p-8 ">
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
								<FaGithub
									size={28}
									className="text-black"
								/>

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