export type Peer = {
  ip: string;
  port: number;
};

export type Info = {
  length?: number; // Only present in single-file torrents
  name: Buffer;
  "piece length": number;
  pieces: Buffer;
  files?: Array<{ // Only present in multi-file torrents
    length: number;
    path: Buffer[];
  }>;
};

export type Torrent = {
  announce: string;
  info: Info;
};
