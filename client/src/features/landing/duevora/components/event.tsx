import Slider from "./slider";
import { motion, MotionValue, useTransform } from "framer-motion";

export default function Workflow({
	scrollYProgress,
}: {
	scrollYProgress: MotionValue<number>;
}) {
	const rotate = useTransform(scrollYProgress, [0, 1], [0, 0]);
	const scale = useTransform(scrollYProgress, [0, 1], [0.8, 1]);

	return (
		<motion.div
			style={{ scale, rotate }}
			className="w-full min-h-screen bg-eventBgColor sticky top-0 left-0"
		>
			<div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-5 md:gap-2 pt-20 md:pt-60 px-5 md:px-10">
				<span className="flex text-[90px] sm:text-[140px] md:text-[200px] uppercase leading-none font-humaneMedium text-white">
					{"workflow".split("").map((item: string, i: number) => (
						<motion.p
							key={i}
							initial={{ y: "100%" }}
							whileInView={{ y: 0 }}
							transition={{
								delay: i * 0.05,
								duration: 0.5,
								ease: [0.4, 0, 0.2, 1],
							}}
							viewport={{ once: true }}
						>
							{item}
						</motion.p>
					))}
				</span>

				<h1 className="text-[18px] md:text-[22px] font-helveticaNeue leading-[0.9] text-white uppercase text-left md:text-right mt-5 md:mt-0">
	Create stunning videos
	<br />
	with{" "}
	<span className="text-[32px] font-bodoniseventytwo lowercase">
		smart
	</span>{" "}
	AI tools
	<br />
	and{" "}
	<span className="text-[32px] font-bodoniseventytwo lowercase">
		total
	</span>{" "}
	creative freedom.
</h1>
			</div>

			<Slider />
		</motion.div>
	);
}
