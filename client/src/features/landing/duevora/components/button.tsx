import { Link } from "react-router";

type ButtonProps = {
	title: string;
	to?: string;
	variant?: "outline" | "solid";
	className?: string;
};

export default function Button({ title, to, variant = "outline", className = "" }: ButtonProps) {
	const baseClass =
		variant === "solid"
			? "px-5 py-2.5 bg-white text-black hover:bg-neutral-100 rounded-full text-xs sm:text-sm leading-tight tracking-wider uppercase font-bold font-helveticaNeue transition-all duration-200 shadow-md inline-flex items-center justify-center cursor-pointer select-none"
			: "px-5 py-2.5 border-[2px] border-white text-white hover:bg-white hover:text-black rounded-full text-xs sm:text-sm leading-tight tracking-wider uppercase font-medium font-helveticaNeue transition-all duration-200 inline-flex items-center justify-center cursor-pointer select-none";

	const combinedClass = `${baseClass} ${className}`;

	if (to) {
		return (
			<Link to={to} className={combinedClass}>
				{title}
			</Link>
		);
	}

	return <button className={combinedClass}>{title}</button>;
}
