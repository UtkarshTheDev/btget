export type Peer = {
	ip: string;
	port: number;
};

export interface File {
	length: number;
	path: Buffer[];
}

export type Info = {
	length?: number; // Only present in single-file torrents
	name: Buffer;
	"piece length": number;
	pieces: Buffer;
	files?: File[]; // Only present in multi-file torrents
};

export type Torrent = {
	announce: string;
	"announce-list"?: string[][];
	info: Info;
};

export interface ProgressData {
	downloaded: number;
	uploaded: number;
	downloadSpeed: number;
	uploadSpeed: number;
	peers: number;
	seeds: number;
	leechers: number;
}
