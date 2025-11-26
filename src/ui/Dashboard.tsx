import React from "react";
import { Box } from "ink";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { SwarmGrid } from "./SwarmGrid";
import { TorrentState } from "./types";

export const Dashboard = (props: TorrentState) => {
	return (
		<Box flexDirection="column" padding={1}>
			<Header />
			<Hero
				filename={props.filename}
				size={props.size}
				hash={props.hash}
				progress={props.progress}
				speed={props.speed}
				eta={props.eta}
				status={props.status}
				speedHistory={props.speedHistory}
			/>
			<SwarmGrid
				peers={props.peers}
				seeds={props.seeds}
				leechers={props.leechers}
				ratio={props.seeds > 0 ? props.leechers / props.seeds : 0} // Simple ratio calc
				trackersActive={3} // Mock for now or pass from state
				trackersTotal={8}
			/>
		</Box>
	);
};
