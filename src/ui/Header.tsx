import { Box, Text } from "ink";
import { useEffect, useState } from "react";

export const Header = () => {
	const [blink, setBlink] = useState(true);

	useEffect(() => {
		const BLINK_INTERVAL_MS = 800;
		const blinker = setInterval(() => {
			setBlink((prev) => !prev);
		}, BLINK_INTERVAL_MS);
		return () => {
			clearInterval(blinker);
		};
	}, []);
	return (
		<Box
			borderStyle="double"
			borderColor="white"
			flexDirection="row"
			justifyContent="space-between"
			paddingX={1}
			marginBottom={1}
		>
			<Box flexDirection="row" alignItems="center">
				<Text color="cyan" bold>
					BTGET
				</Text>
				<Text dimColor> v1.1.0</Text>
			</Box>
			<Box flexDirection="row" alignItems="center">
				<Text>
					[ <Text bold>ONLINE</Text>{" "}
					<Text color={blink ? "green" : "gray"}>●</Text> ]
				</Text>
				<Text dimColor>
					{" "}
					|{" "}
					{new Date().toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
					})}
				</Text>
			</Box>
		</Box>
	);
};
