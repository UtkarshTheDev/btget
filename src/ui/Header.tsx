import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { THEME } from "./theme";

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
			flexDirection="row"
			justifyContent="space-between"
			paddingX={1}
			paddingY={0}
			marginBottom={0}
			borderStyle="classic"
			borderColor={THEME.catppuccin.surface2}
		>
			<Box flexDirection="row" alignItems="center" gap={1}>
				<Text
					color={THEME.catppuccin.base}
					backgroundColor={THEME.catppuccin.mauve}
					bold
				>
					{" BTGET "}
				</Text>
				<Text color={THEME.catppuccin.overlay1}>v1.1.0</Text>
			</Box>
			<Box flexDirection="row" alignItems="center">
				<Text>
					<Text color={THEME.catppuccin.subtext0}>[ </Text>
					<Text bold color={THEME.catppuccin.green}>
						ONLINE
					</Text>{" "}
					<Text
						color={blink ? THEME.catppuccin.green : THEME.catppuccin.surface2}
					>
						●
					</Text>
					<Text color={THEME.catppuccin.subtext0}> ]</Text>
				</Text>
				<Text color={THEME.catppuccin.overlay1}>
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
