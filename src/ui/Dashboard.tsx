import { Box } from "ink";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { SwarmGrid } from "./SwarmGrid";
import { TorrentState } from "./types";

// Helper function to format bytes
const formatBytes = (bytes: number): string => {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

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
				uploadSpeed={props.uploadSpeed}
				eta={props.eta}
				status={props.status}
				speedHistory={props.speedHistory}
				uploadSpeedHistory={props.uploadSpeedHistory}
			/>
			<SwarmGrid
				peers={props.peers}
				seeds={props.seeds}
				leechers={props.leechers}
				ratio={props.ratio}
				uploaded={formatBytes(props.uploaded)}
				downloaded={formatBytes(props.downloaded)}
				trackersActive={3}
				trackersTotal={8}
			/>
		</Box>
	);
};
