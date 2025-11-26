import { startUI } from "./src/ui/render";

const ui = startUI({
	filename: "test.iso",
	size: "1.2 GB",
	hash: "abcdef12",
	progress: 50,
	speed: 1024,
	eta: "5m",
	peers: 10,
	seeds: 5,
	leechers: 5,
	status: "Testing...",
	speedHistory: Array(15).fill(0),
});

setTimeout(() => {
	ui.updateUI({ progress: 60, speed: 2048 });
}, 1000);

setTimeout(() => {
	ui.stopUI();
}, 2000);
