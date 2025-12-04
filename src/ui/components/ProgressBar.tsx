import { Text } from "ink";
import { THEME } from "../theme";

interface ProgressBarProps {
	progress: number; // 0-100
	width?: number;
	color?: string;
	emptyColor?: string;
}

export const ProgressBar = ({
	progress,
	width = 20,
	color = THEME.catppuccin.blue,
	emptyColor = THEME.catppuccin.surface1,
}: ProgressBarProps) => {
	const BLOCKS = ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];
	const percent = Math.min(100, Math.max(0, progress)) / 100;
	const filledWidth = width * percent;
	const fullBlocks = Math.floor(filledWidth);
	const remainder = filledWidth - fullBlocks;
	const partialBlockIndex = Math.floor(remainder * BLOCKS.length);

	const filled = "█".repeat(fullBlocks);
	const partial =
		fullBlocks < width && partialBlockIndex > 0
			? BLOCKS[partialBlockIndex]
			: "";
	const empty = "░".repeat(Math.max(0, width - fullBlocks - (partial ? 1 : 0)));

	return (
		<Text>
			<Text color={color}>
				{filled}
				{partial}
			</Text>
			<Text color={emptyColor}>{empty}</Text>
		</Text>
	);
};
