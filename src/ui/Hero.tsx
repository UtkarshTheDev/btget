import React from "react";
import { Box, Text } from "ink";
import { HeroProps } from "./types";

export const Hero = ({
	filename,
	size,
	hash,
	progress,
	speed,
	eta,
	status,
	speedHistory = [],
}: HeroProps) => {
	// Custom bar chart renderer
	const renderBars = (data: number[]) => {
		const safeData = data && data.length > 0 ? data : Array(15).fill(0);
		const max = Math.max(...safeData, 1);
		const levels = [" ", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
		return safeData.map((val, i) => {
			const heightIndex = Math.floor((val / max) * (levels.length - 1));
			return (
				<Text key={i} color="cyan">
					{levels[Math.min(heightIndex, levels.length - 1)]}
				</Text>
			);
		});
	};

	const formatSpeed = (speedKb: number) => {
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

			{/* Sparkline Area */}
			<Box
				justifyContent="center"
				alignItems="flex-end"
				height={3}
				marginBottom={1}
			>
				{renderBars(speedHistory)}
			</Box>

			{/* Stats */}
			<Box justifyContent="center" marginBottom={1}>
				<Text dimColor>
					{formatSpeed(speed)} | ETA: {eta} | {progress.toFixed(1)}%
				</Text>
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
