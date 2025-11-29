import { startUI } from "./src/ui/render";

const ui = startUI({
	filename: "test.iso",
	size: "1.2 GB",
	hash: "abcdef12",
	progress: 50,
	speed: 1024,
	uploadSpeed: 512,
	eta: "5m",
	peers: 10,
	seeds: 5,
	leechers: 5,
	status: "Testing...",
	speedHistory: Array(15).fill(0),
	uploadSpeedHistory: Array(15).fill(0),
	uploaded: 524288000, // 500 MB in bytes
	downloaded: 644245094, // ~614 MB in bytes (50% of 1.2 GB)
	ratio: 0.81, // 500/614 ≈ 0.81
});

setTimeout(() => {
	ui.updateUI({ progress: 60, speed: 2048 });
}, 1000);

setTimeout(() => {
	ui.stopUI();
}, 2000);
