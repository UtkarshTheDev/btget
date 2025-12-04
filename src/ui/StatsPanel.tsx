import { Box, Text } from "ink";
import { THEME } from "./theme";
import type { StatsPanelProps } from "./types";

export const StatsPanel = ({
	peers,
	seeds,
	leechers,
	ratio,
	uploaded,
	downloaded,
	trackersActive,
	trackersTotal,
}: StatsPanelProps) => {
	const getRatioColor = (r: number) => {
		if (r >= 1.0) return THEME.catppuccin.green;
		if (r >= 0.5) return THEME.catppuccin.yellow;
		return THEME.catppuccin.red;
	};

	return (
		<Box
			borderStyle="round"
			borderColor={THEME.catppuccin.surface1}
			flexDirection="row"
			justifyContent="space-around"
			paddingX={1}
			paddingY={0}
			height={3}
		>
			<Box flexDirection="row" gap={1}>
				<Text color={THEME.catppuccin.subtext1}>Peers:</Text>
				<Text color={THEME.catppuccin.blue} bold>
					{peers} ({seeds} S / {leechers} L)
				</Text>
			</Box>

			<Box flexDirection="row" gap={1}>
				<Text color={THEME.catppuccin.subtext1}>Downloaded:</Text>
				<Text color={THEME.catppuccin.blue} bold>
					{downloaded}
				</Text>
			</Box>

			<Box flexDirection="row" gap={1}>
				<Text color={THEME.catppuccin.subtext1}>Uploaded:</Text>
				<Text color={THEME.catppuccin.green} bold>
					{uploaded}
				</Text>
			</Box>

			<Box flexDirection="row" gap={1}>
				<Text color={THEME.catppuccin.subtext1}>Ratio:</Text>
				<Text color={getRatioColor(ratio)} bold>
					{ratio.toFixed(2)}
				</Text>
			</Box>

			<Box flexDirection="row" gap={1}>
				<Text color={THEME.catppuccin.subtext1}>Trackers:</Text>
				<Text color={THEME.catppuccin.pink} bold>
					{trackersActive}/{trackersTotal}
				</Text>
			</Box>
		</Box>
	);
};
