export interface TorrentState {
	filename: string;
	size: string; // e.g. "2.4 GB"
	hash: string;
	progress: number; // 0-100
	speed: number; // Download KB/s
	uploadSpeed: number; // Upload KB/s
	eta: string; // formatted string
	peers: number;
	seeds: number;
	leechers: number;
	status: string;
	speedHistory: number[];
	uploadSpeedHistory: number[]; // Upload speed history for sparkline
	uploaded: number; // Total uploaded bytes
	downloaded: number; // Total downloaded bytes
	ratio: number; // Upload/download ratio
}

export interface HeroProps {
	filename: string;
	size: string;
	hash: string;
	progress: number;
	speed: number; // Download KB/s
	uploadSpeed: number; // Upload KB/s
	eta: string;
	status: string;
	speedHistory: number[];
	uploadSpeedHistory: number[]; // Upload speed history
}

export interface SwarmGridProps {
	peers: number;
	seeds: number;
	leechers: number;
	ratio: number; // Upload/download ratio
	uploaded: string; // Formatted uploaded bytes
	downloaded: string; // Formatted downloaded bytes
	trackersActive: number;
	trackersTotal: number;
}
