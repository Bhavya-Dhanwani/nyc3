import Eye from "./eye";
import { motion, MotionValue, useTransform } from "framer-motion";

export default function Hero({
	scrollYProgress,
}: {
	scrollYProgress: MotionValue<number>;
}) {
	const scale = useTransform(scrollYProgress, [0, 1], [1, 0.8]);
	const rotate = useTransform(scrollYProgress, [0, 1], [0, -5]);

	return (
		<motion.div
			style={{ scale, rotate }}
			className="w-full h-screen bg-heroColor sticky top-0 left-0 pb-[10vh] overflow-hidden"
		>
			<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
				<h1 className="text-[45vw] uppercase leading-none tracking-[0.03em] font-humaneMedium text-white relative">
					katitor
					<div className="absolute -bottom-10 md:bottom-28 -right-5 md:-right-16 w-[120px] h-[120px] md:w-[250px] md:h-[250px]">
						<div className="relative w-full h-full flex items-center justify-center">
							<motion.img
								animate={{
									rotate: 360,
								}}
								transition={{
									duration: 6,
									ease: "linear",
									repeat: Infinity,
								}}
								src={"/duevora/circlerotation.svg"}
								alt="Katitor"
								className="absolute inset-0 w-full h-full"
							/>

							<h1 className="text-[22px] md:text-[46px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 uppercase leading-tight font-humaneMedium text-black tracking-wide">
								KATITOR
							</h1>
						</div>
					</div>
				</h1>
			</div>

			<div className="hidden md:block">
				<Eye />
			</div>

<div className="absolute bottom-5 w-[95%] md:w-auto left-1/2 -translate-x-1/2 text-center">
	<h1 className="text-[14px] md:text-[18px] font-helveticaNeue leading-tight text-white uppercase">
		The browser-first AI video studio for{" "}
		<span className="text-[24px] font-bodoniseventytwo leading-tight lowercase">
			creators
		</span>
		.
		<br />
		Generate voiceovers, auto-captions, 9:16 shorts, and{" "}
		<span className="text-[24px] font-bodoniseventytwo leading-tight lowercase">
			export
		</span>{" "}
		instantly.
	</h1>
</div>

			<div className="hidden md:block absolute -top-20 -right-20">
				<motion.img
					src={"/duevora/linedraw.svg"}
					alt=""
					width={300}
					height={300}
					className="w-full h-full rotate-[110deg]"
				/>
			</div>

			<div className="hidden md:block absolute bottom-20 -left-20">
				<motion.img
					src={"/duevora/linedraw.svg"}
					alt=""
					width={300}
					height={300}
					className="w-full h-full"
				/>
			</div>
		</motion.div>
	);
}

