import { render } from "ink";
import { Dashboard } from "./Dashboard";
import { TorrentState } from "./types";

const mockState: TorrentState = {
	filename: "Big-Buck-Bunny.mp4",
	size: "1.2 GB",
	hash: "d8f07458c364585354a75b28c891e4531548b264",
	progress: 69.5,
	speed: 1250.5,
	uploadSpeed: 450.2,
	eta: "2m 15s",
	peers: 25,
	seeds: 10,
	leechers: 15,
	status: "Downloading",
	speedHistory: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
	uploadSpeedHistory: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
	uploaded: 123456789,
	downloaded: 987654321,
	ratio: 0.125,
};

render(<Dashboard {...mockState} />);
