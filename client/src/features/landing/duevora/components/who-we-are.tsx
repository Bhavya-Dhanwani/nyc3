"use client";
import { useRef } from "react";
import AnimatedText from "./animated-text";
import { motion, useScroll, useTransform } from "framer-motion";
import {
	emoji1,
	emoji2,
	emoji3,
	flowCurveText,
	whoweareline,
} from "../assets";

export default function WhoWeAre() {
	const container1Ref = useRef(null);
	const container2Ref = useRef(null);

	const { scrollYProgress: scrollYProgress1 } = useScroll({
		target: container1Ref,
		offset: ["start end", "end start"],
	});

	const { scrollYProgress: scrollYProgress2 } = useScroll({
		target: container2Ref,
		offset: ["start end", "end start"],
	});
	const cq = useTransform(scrollYProgress1, [0, 1], [0, 200]);
	const crq = useTransform(scrollYProgress1, [0, 1], [0, 40]);
	const mq = useTransform(scrollYProgress2, [0, 1], [0, -200]);
	const mrq = useTransform(scrollYProgress2, [0, 1], [0, 40]);

	return (
		<>
			<div className="w-full h-screen bg-greenColor pt-20">
				<div className="w-full flex items-center justify-between gap-5 p-10 h-full">
					<div className="w-1/2 flex flex-col justify-between gap-5 relative h-full">
						<div className="flex flex-col">
							<AnimatedText
    text="Why Choose"
    className="text-[250px] text-[#1c1c1c] overflow-hidden leading-[0.85]"
/>
<AnimatedText
    text="Duevora"
    className="text-[250px] text-[#1c1c1c] overflow-hidden leading-[0.85]"
/>
						</div>
						<div className="absolute top-1/2 -left-1/4 -translate-y-1/2 overflow-hidden">
							<img
								src={whoweareline}
								alt="whoweareimg"
								width={300}
								height={300}
							/>
						</div>
						<div className="w-full flex justify-end items-end">
							<motion.p className="w-1/2 leading-tight text-lg uppercase font-helveticaNeue text-[#1c1c1c]">
	Duevora is an all-in-one business management platform
	built for modern MSMEs. Manage inventory, sales,
	purchases, employees, and finances from a single,
	intuitive workspace designed to help your business grow.
</motion.p>
						</div>
					</div>
					<div
						ref={container1Ref}
						className="w-1/2 relative h-full flex justify-end items-start">
						<img
							src={flowCurveText}
							alt="flowCurveTextImg"
							width={700}
							height={700}
						/>
						<motion.div
							className="absolute top-0 right-12"
							style={{ y: cq, rotate: crq }}>
							<img
								src={emoji1}
								alt="flowCurveTextImg"
								width={400}
								height={400}
							/>
						</motion.div>
						<div className="absolute -bottom-[8%] left-[20%]">
							<div className="relative">
								<motion.img
									animate={{
										rotate: [0, 360],
										transition: {
											duration: 6,
											ease: "linear",
											repeat: Infinity,
										},
									}}
									src={"/duevora/circlerotation.svg"}
									alt="right eye"
									width={250}
									height={250}
									className="w-[250px] h-[250px]"
								/>
								<h1 className="text-[50px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 uppercase leading-tight font-humaneMedium text-black">
									DUE
								</h1>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div className="w-full h-screen bg-greenColor py-20">
				<div className="w-full flex h-full relative">
					<div
						ref={container2Ref}
						className="w-1/4 flex flex-col justify-between gap-5 relative h-full">
						<motion.div
							className="flex flex-col"
							style={{ y: mq, rotate: mrq }}>
							<img
								src={emoji3}
								alt="emoji3img"
								width={300}
								height={300}
							/>
						</motion.div>
					</div>
					<div className="w-1/2 h-full flex justify-center items-center relative z-50">
						<div className="flex flex-col gap-14">
							<motion.p className="text-center leading-tight tracking-tight text-[18px] uppercase font-medium font-bodoniseventytwo text-white flex items-center justify-center gap-3 flex-col">
								WHY DUEVORA ????
							</motion.p>
							<div className="w-full flex flex-col items-center justify-center overflow-hidden">
								<AnimatedText
    className="text-[white] leading-[0.85] text-[200px] overflow-hidden"
   text="Manage Inventory"
/>

<AnimatedText
    className="text-[white] leading-[0.85] text-[200px] overflow-hidden"
   	text="Track Sales"
/>

<AnimatedText
    className="text-[#1c1c1c] leading-[0.85] text-[200px] overflow-hidden"
    text="Simplify Operations"
/>

<AnimatedText
    className="text-[#1c1c1c] leading-[0.85] text-[200px] overflow-hidden"
   text="Scale Your Business"
/>
							</div>
						</div>
						<motion.div
							className="absolute -bottom-40 -right-10 overflow-hidden"
							style={{ y: mq, rotate: mrq }}>
							<img
								src={emoji2}
								alt="emoji2img"
								width={300}
								height={300}
							/>
						</motion.div>
					</div>
					<div className="w-1/4 h-full overflow-hidden">
						<img
							src={whoweareline}
							alt="whoweareimg"
							width={400}
							height={400}
							className="absolute top-1/2 -right-20 -translate-y-1/2"
						/>
					</div>
				</div>
			</div>
		</>
	);
}
