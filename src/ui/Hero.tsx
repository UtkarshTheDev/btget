import React from "react";
import { Box, Text } from "ink";
import { HeroProps } from "./types";

export const Hero = ({
	filename,
	size,
	hash,
	progress,
	speed,
	uploadSpeed,
	eta,
	status,
	speedHistory = [],
	uploadSpeedHistory = [],
}: HeroProps) => {
	// Custom bar chart renderer
	const renderBars = (data: number[]) => {
		const safeData = data && data.length > 0 ? data : Array(30).fill(0);
		const max = Math.max(...safeData, 1);
		// Use block characters for sparkline visualization
		const levels = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

		// Build the sparkline as a single string
		const sparkline = safeData
			.map((val) => {
				if (val === 0) return " "; // Explicitly handle 0 as space
				const heightIndex = Math.floor((val / max) * (levels.length - 1));
				return levels[Math.min(heightIndex, levels.length - 1)];
			})
			.join("");

		return sparkline;
	};

	const formatSpeed = (speedKb: number) => {
		if (!speedKb || speedKb === 0) return "0 KB/s";
		if (speedKb >= 1024) {
			return `${(speedKb / 1024).toFixed(1)} MB/s`;
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

			{/* Download Sparkline */}
			<Box justifyContent="center" marginBottom={1}>
				<Text color="cyan">{renderBars(speedHistory)}</Text>
			</Box>

			{/* Progress Bar */}
			<Box justifyContent="center" marginY={1}>
				<Text color="cyan">
					{"█".repeat(Math.floor((progress / 100) * 60))}
				</Text>
				<Text dimColor>
					{"░".repeat(60 - Math.floor((progress / 100) * 60))}
				</Text>
			</Box>
		</Box>
	);
};
