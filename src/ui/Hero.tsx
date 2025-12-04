import { Box, Text } from "ink";
import { ProgressBar } from "./components/ProgressBar";
import { THEME } from "./theme";
import type { HeroProps } from "./types";

export const Hero = ({
	filename,
	size,
	hash,
	progress,
	speed,
	uploadSpeed,
	eta,
	status,
}: HeroProps) => {
	const KB_THRESHOLD = 1024;
	const PROGRESS_BAR_WIDTH = 60;

	const formatSpeed = (speedKb: number) => {
		if (!speedKb || speedKb === 0) return "0 KB/s";
		if (speedKb >= KB_THRESHOLD) {
			return `${(speedKb / KB_THRESHOLD).toFixed(1)} MB/s`;
		}
		return `${speedKb.toFixed(1)} KB/s`;
	};

	return (
		<Box
			borderStyle="round"
			borderColor={THEME.catppuccin.blue}
			flexDirection="column"
			paddingX={2}
			paddingY={1}
			marginBottom={1}
		>
			{/* Header Row: Filename & Status */}
			<Box
				flexDirection="row"
				justifyContent="space-between"
				marginBottom={2}
				width="100%"
			>
				<Box flexDirection="row" alignItems="center" gap={1}>
					<Text color={THEME.catppuccin.blue}>📄</Text>
					<Text bold color={THEME.catppuccin.text}>
						{filename}
					</Text>
				</Box>
				<Box flexDirection="row" alignItems="center" gap={1}>
					<Text color={THEME.catppuccin.overlay0}>[</Text>
					<Text color={THEME.catppuccin.yellow} bold>
						● {status}
					</Text>
					<Text color={THEME.catppuccin.overlay0}>]</Text>
				</Box>
			</Box>

			{/* Metadata Row */}
			<Box flexDirection="row" justifyContent="space-between" marginBottom={2}>
				<Box flexDirection="row" gap={2}>
					<Text color={THEME.catppuccin.subtext0}>
						💾 <Text color={THEME.catppuccin.overlay1}>{size}</Text>
					</Text>
					<Text color={THEME.catppuccin.subtext0}>
						#️⃣ <Text color={THEME.catppuccin.overlay1}>{hash}</Text>
					</Text>
				</Box>
				<Box>
					<Text color={THEME.catppuccin.blue} bold>
						{(progress || 0).toFixed(1)}%
					</Text>
				</Box>
			</Box>

			{/* Progress Bar */}
			<Box justifyContent="center" marginBottom={2}>
				<ProgressBar
					progress={progress}
					width={PROGRESS_BAR_WIDTH}
					color={THEME.catppuccin.blue}
					emptyColor={THEME.catppuccin.surface1}
				/>
			</Box>

			{/* Stats Grid */}
			<Box
				flexDirection="row"
				justifyContent="space-around"
				paddingTop={1}
				borderStyle="single"
				borderTop={true}
				borderBottom={false}
				borderLeft={false}
				borderRight={false}
				borderColor={THEME.catppuccin.surface1}
			>
				<Box flexDirection="column" alignItems="center">
					<Text color={THEME.catppuccin.green} bold>
						↑ {formatSpeed(uploadSpeed)}
					</Text>
					<Text color={THEME.catppuccin.subtext1} dimColor>
						Upload
					</Text>
				</Box>
				<Box flexDirection="column" alignItems="center">
					<Text color={THEME.catppuccin.blue} bold>
						↓ {formatSpeed(speed)}
					</Text>
					<Text color={THEME.catppuccin.subtext1} dimColor>
						Download
					</Text>
				</Box>
				<Box flexDirection="column" alignItems="center">
					<Text color={THEME.catppuccin.mauve} bold>
						⏱ {eta}
					</Text>
					<Text color={THEME.catppuccin.subtext1} dimColor>
						ETA
					</Text>
				</Box>
			</Box>
		</Box>
	);
};
