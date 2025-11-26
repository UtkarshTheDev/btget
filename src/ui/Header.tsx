import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

export const Header = () => {
	const [time, setTime] = useState(new Date().toLocaleTimeString());
	const [blink, setBlink] = useState(true);

	useEffect(() => {
		const timer = setInterval(() => {
			setTime(new Date().toLocaleTimeString());
		}, 1000);
		const blinker = setInterval(() => {
			setBlink((prev) => !prev);
		}, 800);
		return () => {
			clearInterval(timer);
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
				<Text dimColor> v1.0.0</Text>
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
