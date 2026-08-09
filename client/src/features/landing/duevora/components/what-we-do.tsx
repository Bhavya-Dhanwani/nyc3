import AnimatedText from "./animated-text";
import { party1, party2, party3 } from "../assets";

export default function WhatWeDo() {
	return (
		<>
			<div className="w-full py-20 bg-eventBgColor mt-20">
				<div className="w-full flex items-center justify-between gap-2 pt-60 px-10">
					<AnimatedText
						text="Everything You Need"
						className="text-[250px] text-white overflow-hidden leading-[0.85]"
					/>

					<h1 className="text-[22px] font-helveticaNeue leading-none text-white uppercase text-right">
						One platform to
						<br />
						<span className="text-[32px] font-bodoniseventytwo lowercase">
							create
						</span>{" "}
						viral videos,
						<br />
						powered by AI.
					</h1>
				</div>
			</div>

			<div className="w-full h-screen flex items-center">
	{/* Card 1 */}
	<div className="w-full bg-[#BFFF0A] h-full cursor-pointer relative p-10 group overflow-hidden">
		<div className="w-full flex items-center justify-center h-full">
			<img
				src={party1}
				alt=""
				className="w-[400px] h-[400px] object-cover transition-transform duration-500 group-hover:scale-105"
			/>
		</div>

		<div className="absolute bottom-0">
			<h2 className="text-[130px] uppercase leading-[0.8] text-[#1c1c1c] font-humaneMedium">
				STREAMERS
			</h2>

			<p className="text-lg uppercase text-[#1c1c1c] mb-8 max-w-xs">
				Extract funny moments, reactions, and top plays from 2-hour livestreams automatically.
			</p>
		</div>
	</div>

	{/* Card 2 */}
	<div className="w-full bg-[#5546FF] h-full cursor-pointer relative p-10 group overflow-hidden">
		<div className="w-full flex items-center justify-center h-full">
			<img
				src={party2}
				alt=""
				className="w-[400px] h-[400px] object-cover transition-transform duration-500 group-hover:scale-105"
			/>
		</div>

		<div className="absolute bottom-0">
			<h2 className="text-[130px] uppercase leading-[0.8] text-white font-humaneMedium">
				CREATORS
			</h2>

			<p className="text-lg uppercase text-white/80 mb-8 max-w-xs">
				Turn podcasts, interviews, and long broadcasts into viral 9:16 Shorts & Reels.
			</p>
		</div>
	</div>

	{/* Card 3 */}
	<div className="w-full bg-[#FF7BCA] h-full cursor-pointer relative p-10 group overflow-hidden">
		<div className="w-full flex items-center justify-center h-full">
			<img
				src={party3}
				alt=""
				className="w-[400px] h-[400px] object-cover transition-transform duration-500 group-hover:scale-105"
			/>
		</div>

		<div className="absolute bottom-0">
			<h2 className="text-[130px] uppercase leading-[0.8] text-[#1c1c1c] font-humaneMedium">
				EDITORS
			</h2>

			<p className="text-lg uppercase text-[#1c1c1c] mb-8 max-w-xs">
				Full multi-track timeline control with Whisper captions, AI voices, and keyframes.
			</p>
		</div>
	</div>
</div>
		</>
	);
}
