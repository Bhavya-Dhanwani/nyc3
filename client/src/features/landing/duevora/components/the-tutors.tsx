"use client";
import "swiper/css";
import { useRef, useEffect, useState } from "react";
import { tutorsItems } from "../constants/index.ts";
import { Navigation } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import AnimatedText from "./animated-text";
import Button from "./button";
import { motion, MotionValue, useTransform } from "framer-motion";
import { getAccessToken } from "../../../../lib/api.js";

export default function TheTutors({
	scrollYProgress,
}: {
	scrollYProgress: MotionValue<number>;
}) {
	const swiperRef = useRef<SwiperType | null>(null);
	const rotate = useTransform(scrollYProgress, [0, 0.8], [0, 0]);
	const scale = useTransform(scrollYProgress, [0, 0.8], [0.8, 1]);
	const [isLoggedIn, setIsLoggedIn] = useState(false);

	useEffect(() => {
		setIsLoggedIn(Boolean(getAccessToken()));
	}, []);

	return (
		<motion.div
			style={{ scale, rotate }}
			className="w-full min-h-screen bg-[#010101] sticky top-0 left-0">
			<div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-5 pt-32 md:pt-60 px-6 md:px-10">
				<AnimatedText
					text="Why Creators Love Us"
					className="text-6xl sm:text-8xl md:text-[150px] lg:text-[200px] uppercase leading-none font-humaneMedium text-white"
				/>
				<h1 className="text-lg md:text-[22px] font-helveticaNeue leading-snug text-white uppercase text-left md:text-right mt-4 md:mt-0">
	Built to
	<span className="text-2xl md:text-[32px] font-bodoniseventytwo lowercase">
		accelerate
	</span>
	<br />
	your editing with
	<span className="text-2xl md:text-[32px] font-bodoniseventytwo lowercase">
		local-first
	</span>
	<br />
	AI automation.
</h1>
			</div>
			<div className="slider-container w-full flex flex-col gap-10">
				<div className="w-full">
					<div className="overflow-hidden">
						<Swiper
							modules={[Navigation]}
							breakpoints={{
								0: {
									slidesPerView: 1,
								},
								400: {
									slidesPerView: 1,
								},
								768: {
									slidesPerView: 1,
								},
								1024: {
									slidesPerView: 2,
								},
								1490: {
									slidesPerView: 3,
								},
							}}
							onSwiper={(swiper) => (swiperRef.current = swiper)}>
							{tutorsItems.map((item) => (
								<SwiperSlide key={item.id}>
									<div
										className="swiper-slide h-[1000px] cursor-pointer relative overflow-hidden"
										style={{
											background: item.color,
										}}>
										<img
											src={item.img}
											alt={item.title}
											className="absolute inset-0 w-full h-full object-cover"
										/>
										<div className="absolute w-full h-full p-8">
											<div className="w-full h-full flex flex-col justify-end items-end">
												<div className="flex w-full items-center justify-between gap-5 flex-col">
													<div className="flex flex-col gap-2">
														<h2 className="text-[120px] uppercase tracking-wide leading-[0.8] text-white font-humaneMedium">
															{item.title}
														</h2>
													</div>
													<div className="flex items-end justify-end">
														<p
															className={`text-[16px] leading-tight font-helveticaNeue tracking-tight py-2 px-4 rounded-full uppercase ${
																item.id === 1 ? "text-white" : "text-[#1c1c1c]"
															}`}
															style={{
																background: item.color,
															}}>
															{item.btn}
														</p>
													</div>
												</div>
											</div>
										</div>
									</div>
								</SwiperSlide>
							))}
					</Swiper>
					</div>
				</div>
			</div>
			<div className="w-full grid grid-cols-2 lg:grid-cols-4 items-center justify-center px-6 md:px-10 py-20 md:py-40 gap-8 md:gap-16 max-w-7xl mx-auto">
	<div className="flex items-end justify-center lg:justify-start">
		<h2 className="text-5xl sm:text-7xl md:text-[120px] uppercase leading-[0.8] text-[#5546FF] font-humaneMedium">
			10X
		</h2>
		<p className="text-white/50 uppercase text-[12px] md:text-[16px] py-2 px-3 md:px-4">
			Faster<br />Production
		</p>
	</div>

	<div className="flex items-end justify-center lg:justify-start">
		<h2 className="text-5xl sm:text-7xl md:text-[120px] uppercase leading-[0.8] text-[#FF7BCA] font-humaneMedium">
			14+
		</h2>
		<p className="text-white/50 uppercase text-[12px] md:text-[16px] py-2 px-3 md:px-4">
			AI Voice<br />Languages
		</p>
	</div>

	<div className="flex items-end justify-center lg:justify-start">
		<h2 className="text-5xl sm:text-7xl md:text-[120px] uppercase leading-[0.8] text-[#BFFF0A] font-humaneMedium">
			2-HRS
		</h2>
		<p className="text-white/50 uppercase text-[12px] md:text-[16px] py-2 px-3 md:px-4">
			Stream Clip<br />Auto Detection
		</p>
	</div>

	<div className="flex items-end justify-center lg:justify-start">
		<h2 className="text-5xl sm:text-7xl md:text-[120px] uppercase leading-[0.8] text-white font-humaneMedium">
			100%
		</h2>
		<p className="text-white/50 uppercase text-[12px] md:text-[16px] py-2 px-3 md:px-4">
			Browser<br />Privacy
		</p>
	</div>
</div>
			<div className="w-full flex items-center justify-center py-10">
				{isLoggedIn ? (
					<Button
						title="Go to Dashboard"
						to="/dashboard"
					/>
				) : (
					<Button
						title="Get Started"
						to="/register"
					/>
				)}
			</div>
		</motion.div>
	);
}

