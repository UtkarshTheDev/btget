export interface TorrentState {
	filename: string;
	size: string; // e.g. "2.4 GB"
	hash: string;
	progress: number; // 0-100
	speed: number; // KB/s
	eta: string; // formatted string
	peers: number;
	seeds: number;
	leechers: number;
	status: string;
	speedHistory: number[];
}

export interface HeroProps {
	filename: string;
	size: string;
	hash: string;
	progress: number;
	speed: number;
	eta: string;
	status: string;
	speedHistory: number[];
}

export interface SwarmGridProps {
	peers: number;
	seeds: number;
	leechers: number;
	ratio: number;
	trackersActive: number;
	trackersTotal: number;
}
