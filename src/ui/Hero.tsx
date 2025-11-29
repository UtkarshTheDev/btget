import { Box, Text } from "ink";
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
	const PERCENTAGE_DIVISOR = 100;

	const formatSpeed = (speedKb: number) => {
		if (!speedKb || speedKb === 0) return "0 KB/s";
		if (speedKb >= KB_THRESHOLD) {
			return `${(speedKb / KB_THRESHOLD).toFixed(1)} MB/s`;
		}
		return `${speedKb.toFixed(1)} KB/s`;
	};

	return (
		<Box
			borderStyle="single"
			borderColor="blue"
			flexDirection="column"
			paddingX={1}
			marginBottom={1}
		>
			{/* Top Info */}
			<Box flexDirection="column" marginBottom={1}>
				<Text bold color="white">
					📄 {filename}
				</Text>
				<Text dimColor>
					Size: {size} | Hash: {hash}
				</Text>
			</Box>

			{/* Center Status */}
			<Box justifyContent="center" marginBottom={1} marginTop={1}>
				<Text color="yellow">{status}</Text>
			</Box>

			{/* Stats */}
			<Box justifyContent="center" marginBottom={1}>
				<Text>
					<Text color="cyan">↓ {formatSpeed(speed)}</Text>
					<Text dimColor> | </Text>
					<Text color="green">↑ {formatSpeed(uploadSpeed)}</Text>
					<Text dimColor>
						{" "}
						| ETA: {eta} | {(progress || 0).toFixed(1)}%
					</Text>
				</Text>
			</Box>

			{/* Progress Bar */}
			<Box justifyContent="center" marginY={1}>
				<Text color="cyan">
					{"█".repeat(
						Math.floor((progress / PERCENTAGE_DIVISOR) * PROGRESS_BAR_WIDTH),
					)}
				</Text>
				<Text dimColor>
					{"░".repeat(
						PROGRESS_BAR_WIDTH -
							Math.floor((progress / PERCENTAGE_DIVISOR) * PROGRESS_BAR_WIDTH),
					)}
				</Text>
			</Box>
		</Box>
	);
};
