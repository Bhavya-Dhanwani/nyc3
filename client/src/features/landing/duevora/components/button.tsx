import { Link } from "react-router";

type ButtonProps = {
	title: string;
	to?: string;
};

export default function Button({ title, to }: ButtonProps) {
	const className =
		"px-4 py-2 border-[2px] outline-none border-white rounded-full text-sm text-white leading-tight tracking-tight uppercase font-medium font-helveticaNeue";

	if (to) {
		return (
			<Link
				to={to}
				className={className}>
				{title}
			</Link>
		);
	}

	return <button className={className}>{title}</button>;
}
