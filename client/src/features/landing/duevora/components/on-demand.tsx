import AnimatedText from "./animated-text";
import { motion, MotionValue, useTransform } from "framer-motion";

export default function ProductShowcase({
	scrollYProgress,
}: {
	scrollYProgress: MotionValue<number>;
}) {
	const scale = useTransform(scrollYProgress, [0, 0.3], [0.8, 1]);
	const rotate = useTransform(scrollYProgress, [0, 0.3], [-5, 0]);

	return (
		<>
			{/* Intro */}
			<div className="w-full h-screen flex items-center justify-center">
				<div className="w-full flex flex-col items-center justify-center gap-10 overflow-hidden">
					<AnimatedText
						className="leading-none text-white text-[200px]"
						text="Duevora"
					/>

					<div className="flex flex-col gap-2 items-center justify-center overflow-hidden text-center">
						<AnimatedText
	className="text-white leading-[0.85] text-[120px]"
	text="Manage inventory with confidence."
/>

<AnimatedText
	className="text-white leading-[0.85] text-[120px]"
	text="Streamline sales and purchases."
/>

<AnimatedText
	className="text-white leading-[0.85] text-[120px]"
	text="Track finances and business performance."
/>

<AnimatedText
	className="text-white leading-[0.85] text-[120px]"
	text="Everything your business needs in one platform."
/>
					</div>
				</div>
			</div>

			{/* Video Section */}
			<motion.div
				style={{ scale, rotate }}
				className="w-full h-screen sticky top-0 left-0 overflow-hidden"
			>
				<div className="w-full h-full">
					<video
						src="/duevora/Duevora.mp4"
						autoPlay
						loop
						muted
						className="w-full h-full object-cover"
					/>
				</div>

				{/* Large Text */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
					<h1 className="text-[10vw] uppercase leading-tight whitespace-nowrap font-humaneMedium text-white">
					
					</h1>
				</div>

				{/* Bottom Caption */}
				<div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
					<h1 className="text-[22px] font-helveticaNeue uppercase leading-tight text-white">
						Built
						<span className="text-[34px] font-bodoniseventytwo lowercase">
							{" "}
							for{" "}
						</span>
						modern businesses
						<br />
						to simplify finances with AI
					</h1>
				</div>
			</motion.div>
		</>
	);
}
