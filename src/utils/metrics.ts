/**
 * PHASE 4: Comprehensive Metrics API
 * Tracks detailed statistics for monitoring and debugging
 */

export type Metrics = {};
\ttotalDownloaded: number
\ttotalUploaded: number
\tcurrentDownloadSpeed: number
\tcurrentUploadSpeed: number
\tavgDownloadSpeed: number
\tavgUploadSpeed: number
\tactivePeers: number
\ttotalPeersConnected: number
\tblocksReceived: number
\tblocksRequested: number
\tprotocolErrors: number
\tuptime: number // milliseconds
}

export class MetricsTracker {
	\
	tprivate;
	startTime: number;
	\
	tprivate;
	blocksReceived = 0;
	\
	tprivate;
	blocksRequested = 0;
	\
	tprivate;
	protocolErrors = 0;
	\
	tprivate;
	downloadSpeedHistory: number[] = [];
	\
	tprivate;
	uploadSpeedHistory: number[] = [];
	\
	tprivate;
	readonly MAX_HISTORY_SIZE = 60; // Keep last 60 samples

	\
	tconstructor() {
		\t\tthis.startTime = Date.now()
		\t
	}

	\
	t; /**
\t * Record a block received
\t */
	\
	trecordBlockReceived(): void {
		\t\tthis.blocksReceived++
		\t
	}

	\
	t; /**
\t * Record a block requested
\t */
	\
	trecordBlockRequested(): void {
		\t\tthis.blocksRequested++
		\t
	}

	\
	t; /**
\t * Record a protocol error
\t */
	\
	trecordProtocolError(): void {
		\t\tthis.protocolErrors++
		\t
	}

	\
	t; /**
\t * Record current download speed
\t */
	\
	trecordDownloadSpeed(speed: number): void {
		\t\tthis.downloadSpeedHistory.push(speed)
		\t\tif (this.downloadSpeedHistory.length > this.MAX_HISTORY_SIZE)
		\t\t\tthis.downloadSpeedHistory.shift()
		\t\t
		\t
	}

	\
	t; /**
\t * Record current upload speed
\t */
	\
	trecordUploadSpeed(speed: number): void {
		\t\tthis.uploadSpeedHistory.push(speed)
		\t\tif (this.uploadSpeedHistory.length > this.MAX_HISTORY_SIZE)
		\t\t\tthis.uploadSpeedHistory.shift()
		\t\t
		\t
	}

	\
	t; /**
\t * Get comprehensive metrics
\t */
	\
	tgetMetrics(
	\
	t;
	\
	ttotalDownloaded: number;
	,
\
	t;
	\
	ttotalUploaded: number;
	,
\
	t;
	\
	tcurrentDownloadSpeed: number;
	,
\
	t;
	\
	tcurrentUploadSpeed: number;
	,
\
	t;
	\
	tactivePeers: number;
	,
\
	t;
	\
	ttotalPeersConnected: number;
	,
\
	t;
	):
	Metrics;
	{
\
	t;
	\
	tconst;
	avgDownloadSpeed =
\
	t;
	\
	t;
	\
	tthis;
	.
	downloadSpeedHistory;
	.
	length;
	> 0
\
	t;
	\
	t;
	\
	t;
	\
	t?;
	this;
	.
	downloadSpeedHistory;
	.
	reduce((a, b)
	=>
	a;
	+
	b;
	, 0) /
\
	t;
	\
	t;
	\
	t;
	\
	t;
	this;
	.
	downloadSpeedHistory;
	.
	length;
	\
	t;
	\
	t;
	\
	t;
	\
	t: 0;

	\
	t;
	\
	tconst;
	avgUploadSpeed =
\
	t;
	\
	t;
	\
	tthis;
	.
	uploadSpeedHistory;
	.
	length;
	> 0
\
	t;
	\
	t;
	\
	t;
	\
	t?;
	this;
	.
	uploadSpeedHistory;
	.
	reduce((a, b)
	=>
	a;
	+
	b;
	, 0) /
\
	t;
	\
	t;
	\
	t;
	\
	t;
	this;
	.
	uploadSpeedHistory;
	.
	length;
	\
	t;
	\
	t;
	\
	t;
	\
	t: 0;

	\
	t;
	\
	treturn;
	{
\
	t;
	\
	t;
	\
	ttotalDownloaded;
	,
\
	t;
	\
	t;
	\
	ttotalUploaded;
	,
\
	t;
	\
	t;
	\
	tcurrentDownloadSpeed;
	,
\
	t;
	\
	t;
	\
	tcurrentUploadSpeed;
	,
\
	t;
	\
	t;
	\
	tavgDownloadSpeed;
	,
\
	t;
	\
	t;
	\
	tavgUploadSpeed;
	,
\
	t;
	\
	t;
	\
	tactivePeers;
	,
\
	t;
	\
	t;
	\
	ttotalPeersConnected;
	,
\
	t;
	\
	t;
	\
	tblocksReceived: this;
	.
	blocksReceived;
	,
\
	t;
	\
	t;
	\
	tblocksRequested: this;
	.
	blocksRequested;
	,
\
	t;
	\
	t;
	\
	tprotocolErrors: this;
	.
	protocolErrors;
	,
\
	t;
	\
	t;
	\
	tuptime: Date.now;
	()
	- this.
	startTime;
	,
\
	t;
	\
	t;
}
\t}

\t/**
\t * Reset all metrics
\t */
\treset(): void
{
	\t\tthis.blocksReceived = 0
	\t\tthis.blocksRequested = 0
	\t\tthis.protocolErrors = 0
	\t\tthis.downloadSpeedHistory = []
	\t\tthis.uploadSpeedHistory = []
	\t\tthis.startTime = Date.now()
	\t
}
}
