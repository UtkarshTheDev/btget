import { startUI } from "./src/ui/render";
import { PieceState } from "./src/ui/types";

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
	status: "Downloading",
	speedHistory: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
	uploadSpeedHistory: Array(15).fill(0),
	uploaded: 524288000,
	downloaded: 644245094,
	ratio: 0.81,
});

// Simulate updates
let tick = 0;
let currentHistory = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

setInterval(() => {
	tick++;
	const newSpeed = 1000 + Math.sin(tick) * 500;
	currentHistory = [...currentHistory, newSpeed].slice(-10);

	ui.updateUI({
		progress: 50 + tick * 0.1,
		speed: newSpeed,
		speedHistory: currentHistory,
	});
}, 500);

setTimeout(() => {
	ui.stopUI();
}, 5000);
