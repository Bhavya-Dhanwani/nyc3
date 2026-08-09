import Button from "./button";
import { motion } from "framer-motion";
import { flowCurveTextWhite } from "../assets";

export default function Footer() {
	return (
		<div className="w-full pt-40 px-10">
			<h1 className="text-[25vw] uppercase leading-none text-center tracking-[-5] font-humaneMedium text-white">
				Switch To
			</h1>

			<div className="relative w-full flex items-center justify-center">
				<img
					src={flowCurveTextWhite}
					alt="AUTO"
					width={500}
					height={500}
					className="w-[50%] h-full object-cover"
				/>

				<div className="absolute -bottom-20 right-80">
					<div className="relative">
						<motion.img
							animate={{
								rotate: [0, 360],
								transition: {
									duration: 8,
									ease: "linear",
									repeat: Infinity,
								},
							}}
							src={"/duevora/circlerotation.svg"}
							alt=""
							width={250}
							height={250}
							className="w-[250px] h-[250px]"
						/>

						<h1 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[60px] uppercase leading-none font-humaneMedium text-black">
							DUEVORA
						</h1>
					</div>
				</div>
			</div>

			<div className="w-full flex flex-col items-center justify-center gap-8 py-32">
				<p className="max-w-3xl text-center text-[22px] leading-relaxed uppercase font-helveticaNeue text-white/70">
					Automate invoices, organize expenses, track payments and
					grow your business with one intelligent finance assistant.
				</p>

				<Button
					title="Get Started"
					to="/register"
				/>
			</div>

			<div className="w-full border-t border-white/10 py-8 flex items-center justify-between">
				<p className="text-[18px] uppercase font-helveticaNeue text-white/50">
					© 2026 Duevora
				</p>

				<div className="flex items-center gap-10">
					<a
						
						className="text-[18px] uppercase font-helveticaNeue text-white hover:text-white/70 transition-colors"
					>
						THANKYOU
					</a>

					<a
						
						className="text-[18px] uppercase font-helveticaNeue text-white hover:text-white/70 transition-colors"
					>
						NAMASTE
					</a>

					<a
						
						className="text-[18px] uppercase font-helveticaNeue text-white hover:text-white/70 transition-colors"
					>
						DEV
					</a>
				</div>
			</div>
		</div>
	);
}
