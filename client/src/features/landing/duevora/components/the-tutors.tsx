"use client";
import "swiper/css";
import { useRef } from "react";
import { tutorsItems } from "../constants/index.ts";
import { Navigation } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import AnimatedText from "./animated-text";
import Button from "./button";
import Sticky from "./sticky";
import { motion, MotionValue, useTransform } from "framer-motion";

export default function TheTutors({
	scrollYProgress,
}: {
	scrollYProgress: MotionValue<number>;
}) {
	const swiperRef = useRef<SwiperType | null>(null);
	const rotate = useTransform(scrollYProgress, [0, 0.8], [8, 0]);
	const scale = useTransform(scrollYProgress, [0, 0.8], [0.8, 1]);
	return (
		<motion.div
			style={{ scale, rotate }}
			className="w-full min-h-screen bg-[#010101] sticky top-0 left-0">
			<div className="w-full flex items-center justify-between gap-2 pt-60 px-10">
				<AnimatedText
					text="Why Buisnesses Love Us"
					className="text-[200px] uppercase leading-none font-humaneMedium text-white"
				/>
				<h1 className="text-[22px] font-helveticaNeue leading-[0.9] text-white uppercase text-right">
	Built to
	<span className="text-[32px] font-bodoniseventytwo lowercase">
		simplify
	</span>
	<br />
	your finances with
	<span className="text-[32px] font-bodoniseventytwo lowercase">
		intelligent
	</span>
	<br />
	automation.
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
							<Sticky />
						</Swiper>
					</div>
				</div>
			</div>
			<div className="w-full flex items-center justify-center px-10 py-40 gap-20">
	<div className="flex items-end">
		<h2 className="text-[120px] uppercase leading-[0.8] text-[#5546FF] font-humaneMedium">
			SAVE
		</h2>
		<p className="text-white/50 uppercase text-[16px] py-2 px-4">
			Hours<br />Every Week
		</p>
	</div>

	<div className="flex items-end">
		<h2 className="text-[120px] uppercase leading-[0.8] text-[#FF7BCA] font-humaneMedium">
			SMART
		</h2>
		<p className="text-white/50 uppercase text-[16px] py-2 px-4">
			AI<br />Automation
		</p>
	</div>

	<div className="flex items-end">
		<h2 className="text-[120px] uppercase leading-[0.8] text-[#BFFF0A] font-humaneMedium">
			TRACK
		</h2>
		<p className="text-white/50 uppercase text-[16px] py-2 px-4">
			Payments<br />Instantly
		</p>
	</div>

	<div className="flex items-end">
		<h2 className="text-[120px] uppercase leading-[0.8] text-white font-humaneMedium">
			GROW
		</h2>
		<p className="text-white/50 uppercase text-[16px] py-2 px-4">
			Your<br />Business
		</p>
	</div>
</div>
			<div className="w-full flex items-center justify-center py-10">
				<Button
					title="Get Started"
					to="/register"
				/>
			</div>
		</motion.div>
	);
}
