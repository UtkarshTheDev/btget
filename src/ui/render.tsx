import React, { useState, useEffect } from "react";
import { render, Instance } from "ink";
import { Dashboard } from "./Dashboard";
import { TorrentState } from "./types";
import EventEmitter from "events";

const updateEmitter = new EventEmitter();

const App = ({ initialState }: { initialState: TorrentState }) => {
	const [state, setState] = useState(initialState);

	useEffect(() => {
		const handleUpdate = (newState: Partial<TorrentState>) => {
			setState((prev) => ({ ...prev, ...newState }));
		};

		updateEmitter.on("update", handleUpdate);
		return () => {
			updateEmitter.off("update", handleUpdate);
		};
	}, []);

	return <Dashboard {...state} />;
};

export const startUI = (initialState: TorrentState) => {
	const { unmount, waitUntilExit } = render(
		<App initialState={initialState} />,
	);

	const updateUI = (newState: Partial<TorrentState>) => {
		updateEmitter.emit("update", newState);
	};

	const stopUI = () => {
		unmount();
	};

	return { updateUI, stopUI, waitUntilExit };
};
