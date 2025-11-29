import { Box, Text } from "ink";
import type { SwarmGridProps } from "./types";

export const SwarmGrid = ({
	seeds,
	leechers,
	ratio,
	uploaded,
	downloaded,
	trackersActive,
	trackersTotal,
}: SwarmGridProps) => {
	return (
		<Box
			borderStyle="single"
			borderColor="gray"
			flexDirection="row"
			padding={0}
			height={6}
		>
			{/* Left Column: Swarm Origin */}
			<Box width="50%" flexDirection="column" paddingX={1} borderRight={false}>
				<Text bold>⛁ SWARM ORIGIN</Text>
				<Box flexGrow={1} flexDirection="column" justifyContent="center">
					<Box flexDirection="row" flexWrap="wrap" gap={4}>
						<Text>
							🇺🇸 US: <Text color="cyan">▣▣▣</Text>
						</Text>
						<Text>
							🇩🇪 DE: <Text color="cyan">▣▣</Text>
						</Text>
						<Text>
							🇯🇵 JP: <Text color="cyan">▣▣</Text>
						</Text>
						<Text>
							🇮🇳 IN: <Text color="cyan">▣▣▣▣</Text>
						</Text>
					</Box>
				</Box>
			</Box>

			{/* Vertical Separator */}
			<Box
				width={1}
				borderStyle="single"
				borderTop={false}
				borderBottom={false}
				borderRight={false}
				borderLeft={true}
				borderColor="gray"
			/>

			{/* Right Column: Swarm Stats */}
			<Box width="50%" flexDirection="column" paddingX={1}>
				<Text bold>⛁ SWARM STATS</Text>
				<Box flexDirection="row" flexWrap="wrap" marginTop={2} gap={4}>
					<Text>🌱 Seeds: {seeds}</Text>
					<Text>🐌 Leechers: {leechers}</Text>
					<Text>📤 Up: {uploaded}</Text>
					<Text>📥 Down: {downloaded}</Text>
					<Text>⚖️ Ratio: {(ratio || 0).toFixed(2)}</Text>
					<Text>
						📡 Trackers: {trackersActive}/{trackersTotal}
					</Text>
				</Box>
			</Box>
		</Box>
	);
};
